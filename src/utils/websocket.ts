import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from './logger';

export interface WebSocketUserData {
  userId?: string;
  clientId?: string;
  // 可以根据需要添加更多用户信息
}

export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, WebSocketUserData> = new Map();
  private userIdToClientMap: Map<string, WebSocket> = new Map();
  private clientIdToClientMap: Map<string, WebSocket> = new Map();

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public initialize(server: any): void {
    // 从认证中间件导入认证函数
    const { authenticateWebSocket } = require('../middlewares/ws-auth.middleware');

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws', // WebSocket路径
      verifyClient: async (info: { origin: string; secure: boolean; req: IncomingMessage }): Promise<boolean> => {
        // 使用认证中间件进行验证
        return await authenticateWebSocket(info.req);
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      // 连接已经通过认证，可以直接处理
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket Server Error:', error);
    });

    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    // 连接已经通过认证，从URL中提取用户信息
    const token = request.url ? this.extractTokenFromUrl(request.url) : null;
    let userId: string | null = null;

    if (token) {
      try {
        // 解析JWT token获取用户ID
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, secret) as { id: string; iat: number; exp: number };
        userId = decoded.id.toString();
      } catch (error) {
        logger.error('Failed to decode token in handleConnection:', error);
      }
    }

    logger.info(`New WebSocket connection from ${request.socket.remoteAddress}, authenticated user: ${userId}`);

    // 设置客户端信息
    const userData: WebSocketUserData = {
      userId: userId || undefined,
      clientId: this.generateClientId()
    };
    this.clients.set(ws, userData);
    
    // 添加到ID映射中
    if (userData.clientId) {
      this.clientIdToClientMap.set(userData.clientId, ws);
    }
    
    // 添加到userId映射中
    if (userData.userId) {
      this.setUserId(ws, userData.userId);
    }

    // 监听消息
    ws.on('message', (data: string) => {
      this.handleMessage(ws, data);
    });

    // 监听关闭
    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    // 监听错误
    ws.on('error', (error) => {
      logger.error('WebSocket Error:', error);
      this.clients.delete(ws);
    });

    // 发送连接确认消息
    this.send(ws, {
      type: 'connected',
      payload: { 
        clientId: userData.clientId, 
        userId: userData.userId,
        timestamp: new Date().toISOString() 
      }
    });
  }

  // 从URL中提取token的辅助函数
  private extractTokenFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url, `http://localhost`);
      return parsedUrl.searchParams.get('token');
    } catch (error) {
      logger.error('Error parsing WebSocket URL:', error);
      return null;
    }
  }

  private handleMessage(ws: WebSocket, data: string): void {
    try {
      const message = JSON.parse(data);
      const clientData = this.clients.get(ws);

      logger.info(`Received message from client ${clientData?.clientId}:`, message);

      // 根据消息类型处理不同逻辑
      switch (message.type) {
        case 'ping':
          this.send(ws, { type: 'pong', payload: message.payload });
          break;
        
        case 'subscribe':
          // 处理订阅请求
          this.handleSubscribe(ws, message.payload);
          break;
        
        case 'unsubscribe':
          // 处理取消订阅请求
          this.handleUnsubscribe(ws, message.payload);
          break;
        
        default:
          // 广播消息给其他客户端或处理业务逻辑
          this.broadcastToOthers(ws, message);
          break;
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
      this.send(ws, { 
        type: 'error', 
        payload: { message: 'Invalid message format' } 
      });
    }
  }

  private handleSubscribe(ws: WebSocket, payload: any): void {
    const clientData = this.clients.get(ws);
    logger.info(`Client ${clientData?.clientId} subscribed to:`, payload);
    // 这里可以实现具体的订阅逻辑
    this.send(ws, { 
      type: 'subscription_success', 
      payload: { channel: payload.channel } 
    });
  }

  private handleUnsubscribe(ws: WebSocket, payload: any): void {
    const clientData = this.clients.get(ws);
    logger.info(`Client ${clientData?.clientId} unsubscribed from:`, payload);
    // 这里可以实现具体的取消订阅逻辑
    this.send(ws, { 
      type: 'unsubscription_success', 
      payload: { channel: payload.channel } 
    });
  }

  private handleDisconnect(ws: WebSocket): void {
    const clientData = this.clients.get(ws);
    logger.info(`WebSocket client disconnected: ${clientData?.clientId}`);
    
    // 从映射中移除
    if (clientData?.clientId) {
      this.clientIdToClientMap.delete(clientData.clientId);
    }
    
    this.clients.delete(ws);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public send(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
  
  public sendToClientId(clientId: string, message: any): boolean {
    const client = this.clientIdToClientMap.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  public sendToUserId(userId: string, message: any): boolean {
    // 在实际实现中，你需要维护userId到WebSocket连接的映射
    // 这里我们简单地遍历所有客户端查找匹配的userId
    let sent = false;
    
    this.clients.forEach((userData, client) => {
      if (userData.userId === String(userId) && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
        sent = true;
      }
    });
    
    return sent;
  }
  
  public setUserId(ws: WebSocket, userId: string): void {
    const userData = this.clients.get(ws);
    if (userData) {
      userData.userId = userId;
      
      // 也添加到userId映射中
      this.userIdToClientMap.set(userId, ws);
    }
  }

  public broadcast(message: any, excludeClient?: WebSocket): void {
    const messageStr = JSON.stringify(message);
    
    this.wss?.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  public broadcastToOthers(sender: WebSocket, message: any): void {
    this.broadcast(message, sender);
  }

  public broadcastToChannel(channel: string, message: any, excludeClient?: WebSocket): void {
    const messageStr = JSON.stringify({
      ...message,
      channel
    });

    this.wss?.clients.forEach((client) => {
      if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
        // 这里可以实现基于频道的过滤逻辑
        client.send(messageStr);
      }
    });
  }

  public getClientsCount(): number {
    return this.wss?.clients.size || 0;
  }
  
  public getStats() {
    return {
      connectedClients: this.getClientsCount(),
      uptime: new Date().toISOString(),
      status: 'running'
    };
  }

  public getClients(): WebSocketUserData[] {
    const clients: WebSocketUserData[] = [];
    this.clients.forEach((data) => {
      clients.push(data);
    });
    return clients;
  }
  
  public getClientByUserId(userId: string): WebSocket | undefined {
    return this.userIdToClientMap.get(userId);
  }
  
  public getClientByClientId(clientId: string): WebSocket | undefined {
    return this.clientIdToClientMap.get(clientId);
  }

  public close(): void {
    if (this.wss) {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
      
      // 关闭所有客户端连接
      this.wss.clients.forEach((client) => {
        client.close();
      });
      
      this.clients.clear();
    }
  }
}