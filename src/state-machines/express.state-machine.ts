import { ExpressTrackingService } from '../services/express-tracking.service';
import { logger } from '../utils/logger';

/**
 * 状态转换事件类型
 */
type TransitionEvent = 
  | 'INTERCEPTION_CREATED'      // 拦截请求创建
  | 'INTERCEPTION_RETURNED'     // 快递已退回
  | 'SIGNED'                    // 已签收
  | 'CONFIRMED'                 // 已确认
  | 'WAREHOUSE_IN'              // 已入库
  | 'CLAIM_APPLIED'             // 申请理赔
  | 'CLAIM_APPROVED'            // 理赔通过
  | 'CLAIM_REJECTED'            // 理赔拒绝
  | 'CLOSED'                    // 完结
  | 'TIMEOUT';                  // 超时

/**
 * 状态转换参数
 */
interface TransitionParams {
  operator?: string;
  remarks?: string;
  returnedAt?: Date;
  signedAt?: Date;
  warehouseReceivedAt?: Date;
}

/**
 * 快递状态机
 * 管理快递拦截记录的状态流转
 */
export class ExpressStateMachine {
  private trackingService: ExpressTrackingService;

  /**
   * 状态定义（与数据库 smallint 值对应）
   */
  static readonly States = {
    PENDING: 0,             // 待处理
    IN_TRANSIT: 1,          // 拦截中
    RETURNED: 2,            // 已退回
    SIGNED: 3,              // 已签收
    CONFIRMED: 4,           // 已确认
    TIMEOUT: 5,             // 超时待核实
    WAREHOUSED: 6,          // 已入库
    CLAIMED: 7,             // 理赔中
    CLOSED: 8,              // 已完结
  };

  /**
   * 状态转换配置
   * key: 当前状态（number）
   * value: 可转换到的目标状态数组
   */
  private readonly transitions: Record<number, number[]> = {
    [ExpressStateMachine.States.PENDING]: [
      ExpressStateMachine.States.IN_TRANSIT,
      ExpressStateMachine.States.RETURNED,
      ExpressStateMachine.States.SIGNED,
      ExpressStateMachine.States.CONFIRMED,
      ExpressStateMachine.States.TIMEOUT,
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.IN_TRANSIT]: [
      ExpressStateMachine.States.RETURNED,
      ExpressStateMachine.States.SIGNED,
      ExpressStateMachine.States.TIMEOUT,
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.RETURNED]: [
      ExpressStateMachine.States.WAREHOUSED,
      ExpressStateMachine.States.CLAIMED,
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.SIGNED]: [
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.CONFIRMED]: [
      ExpressStateMachine.States.RETURNED,
      ExpressStateMachine.States.WAREHOUSED,
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.TIMEOUT]: [
      ExpressStateMachine.States.CONFIRMED,
      ExpressStateMachine.States.RETURNED,
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.WAREHOUSED]: [
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.CLAIMED]: [
      ExpressStateMachine.States.CLOSED,
    ],
    [ExpressStateMachine.States.CLOSED]: [], // 终态，不可转换
  };

  constructor() {
    this.trackingService = new ExpressTrackingService();
  }

  /**
   * 执行状态转换
   * @param trackingNumber 快递单号
   * @param event 转换事件
   * @param params 转换参数
   */
  async transition(
    trackingNumber: string,
    event: TransitionEvent,
    params: TransitionParams = {}
  ): Promise<boolean> {
    const record = await this.trackingService.findByTrackingNumber(trackingNumber);

    if (!record) {
      logger.warn(`状态转换失败: 未找到记录 ${trackingNumber}`);
      throw new Error(`未找到单号 ${trackingNumber} 的记录`);
    }

    const currentState = record.status;
    const targetState = this.mapEventToState(event);

    if (targetState === null) {
      logger.warn(`状态转换失败: 未知事件 ${event}`);
      return false;
    }

    // 检查转换是否合法
    if (!this.canTransition(currentState, targetState)) {
      logger.warn(`状态转换失败: ${currentState} -> ${targetState} 不合法`);
      throw new Error(`状态转换不合法: ${currentState} 不能转换到 ${targetState}`);
    }

    // 执行转换
    const updated = await this.trackingService.updateStatus(record.id, {
      status: targetState,
      operator: params.operator,
      remarks: params.remarks,
      returnedAt: params.returnedAt,
      signedAt: params.signedAt,
      warehouseReceivedAt: params.warehouseReceivedAt,
    });

    if (updated) {
      logger.info(`状态转换成功: ${trackingNumber} ${currentState} -> ${targetState}`);
    }

    return !!updated;
  }

  /**
   * 将事件映射到目标状态
   */
  private mapEventToState(event: TransitionEvent): number | null {
    const eventMap: Record<TransitionEvent, number> = {
      'INTERCEPTION_CREATED': ExpressStateMachine.States.PENDING,
      'INTERCEPTION_RETURNED': ExpressStateMachine.States.RETURNED,
      'SIGNED': ExpressStateMachine.States.SIGNED,
      'CONFIRMED': ExpressStateMachine.States.CONFIRMED,
      'WAREHOUSE_IN': ExpressStateMachine.States.WAREHOUSED,
      'CLAIM_APPLIED': ExpressStateMachine.States.CLAIMED,
      'CLAIM_APPROVED': ExpressStateMachine.States.CLOSED,
      'CLAIM_REJECTED': ExpressStateMachine.States.CLAIMED,
      'CLOSED': ExpressStateMachine.States.CLOSED,
      'TIMEOUT': ExpressStateMachine.States.TIMEOUT,
    };

    return eventMap[event] ?? null;
  }

  /**
   * 检查是否可以进行状态转换
   */
  private canTransition(from: number, to: number): boolean {
    const allowedStates = this.transitions[from];
    if (!allowedStates) {
      return false;
    }
    return allowedStates.includes(to);
  }

  /**
   * 获取当前可用的转换
   */
  getAvailableTransitions(currentState: number): number[] {
    return this.transitions[currentState] || [];
  }

  /**
   * 检查是否为终态
   */
  isFinalState(state: number): boolean {
    return this.transitions[state]?.length === 0;
  }

  /**
   * 获取状态显示名称
   */
  static getStateDisplayName(state: number): string {
    const displayNames: Record<number, string> = {
      [ExpressStateMachine.States.PENDING]: '待处理',
      [ExpressStateMachine.States.IN_TRANSIT]: '拦截中',
      [ExpressStateMachine.States.RETURNED]: '已退回',
      [ExpressStateMachine.States.SIGNED]: '已签收',
      [ExpressStateMachine.States.CONFIRMED]: '已确认',
      [ExpressStateMachine.States.TIMEOUT]: '超时待核实',
      [ExpressStateMachine.States.WAREHOUSED]: '已入库',
      [ExpressStateMachine.States.CLAIMED]: '理赔中',
      [ExpressStateMachine.States.CLOSED]: '已完结',
    };
    return displayNames[state] || String(state);
  }

  /**
   * 获取状态颜色（用于前端显示）
   */
  static getStateColor(state: number): string {
    const colors: Record<number, string> = {
      [ExpressStateMachine.States.PENDING]: '#909399',   // 灰色
      [ExpressStateMachine.States.IN_TRANSIT]: '#409EFF', // 蓝色
      [ExpressStateMachine.States.RETURNED]: '#E6A23C',  // 橙色
      [ExpressStateMachine.States.SIGNED]: '#67C23A',    // 绿色
      [ExpressStateMachine.States.CONFIRMED]: '#409EFF',  // 蓝色
      [ExpressStateMachine.States.TIMEOUT]: '#F56C6C',   // 红色
      [ExpressStateMachine.States.WAREHOUSED]: '#67C23A',// 绿色
      [ExpressStateMachine.States.CLAIMED]: '#E6A23C',   // 橙色
      [ExpressStateMachine.States.CLOSED]: '#909399',    // 灰色
    };
    return colors[state] || '#909399';
  }
}
