import { Request, Response } from 'express';
import axios from 'axios';
import { AppDataSource } from '../config/database';
import { CsConfig } from '../models/cs-config.model';
import { KnowledgeBase } from '../models/knowledge-base.model';
import { logger } from '../utils/logger';
import { errorResponse, successResponse } from '../utils/response';

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:8000';

// 默认系统提示词
const DEFAULT_SYSTEM_PROMPT = `# 角色设定
你是一名拥有10年经验的淘宝"金牌客服兼销售专家"。你的目标是：在遵守淘宝规则的前提下，以专业、自信、耐心、极具亲和力的方式解答问题，并最大化促成交易。

# 核心行为准则
1. 【边界感】必须始终根据给定的知识库原文背景来进行回答。
2. 【事实准绳】绝不捏造任何原文档里没有提到的技术参数或具体规则，如果无法在背景知识中找到答案，请礼貌地声称"抱歉，我目前的产品知识库中没有收录该信息，建议您联系人工客服为您跟进处理。"
3. 【绝对安全】严禁辱骂、讽刺买家，严禁承认"假货/质量差"等负面词汇。遇到恶意挑衅，用专业且不容置疑的官方话术化解。
4. 【强势逼单】当买家犹豫价格或赠品时，使用"限时限量"、"库存紧张"、"专属特权"等话术制造稀缺感，引导立即下单。
5. 【专业引导】不要只回答"是/否"，要主动抛出问题引导需求。
6. 【格式严格】如果需要调用系统接口，必须严格输出 JSON 格式。

# 话术风格
- 称呼：使用"您"或"亲"，保持不卑不亢的专业感。
- 语气：自信、热情、干脆利落。
- 长度：每次回复控制在 100 字以内，分点说明，便于手机端阅读。`;

export class CsController {

  // ========== AI 客服聊天（代理 ai-gateway） ==========

  async chat(req: Request, res: Response): Promise<Response> {
    try {
      const { message, knowledgeBaseId, mode } = req.body;

      if (!message) {
        return errorResponse(res, 400, '消息内容不能为空', null);
      }

      // 从数据库获取配置
      const config = await this._getConfig();

      // 构建 ai-gateway 请求
      const payload: any = {
        message,
        temperature: config.temperature,
        max_tokens: 2048,
        rag_top_k: config.maxRetrievalCount,
        system_prompt: config.systemPrompt,
      };

      // 知识库 ID：指定知识库或搜索全部
      payload.kb_id = knowledgeBaseId ? String(knowledgeBaseId) : 'all';

      // 调用 ai-gateway /cs/chat
      const resp = await axios.post(`${AI_GATEWAY_URL}/cs/chat`, payload, {
        timeout: 120000,
      });

      const data = resp.data;
      return successResponse(res, {
        reply: data.reply || '',
        sources: data.sources || [],
        latency: data.latency || 0,
      }, 'AI 回复成功');
    } catch (error: any) {
      const detail = error.response?.data?.detail || error.message;
      logger.error('AI 客服聊天失败:', detail);
      return errorResponse(res, 502, `AI 服务调用失败: ${detail}`, null);
    }
  }

  // ========== 配置管理 ==========

  async getConfig(_req: Request, res: Response): Promise<Response> {
    try {
      const config = await this._getConfig();
      return successResponse(res, {
        temperature: Number(config.temperature),
        similarityThreshold: Number(config.similarityThreshold),
        maxRetrievalCount: config.maxRetrievalCount,
        enableAutoParse: config.enableAutoParse === 1,
        systemPrompt: config.systemPrompt,
      }, '获取配置成功');
    } catch (error) {
      logger.error('获取 CS 配置失败:', error);
      return errorResponse(res, 500, '获取配置失败', null);
    }
  }

  async saveConfig(req: Request, res: Response): Promise<Response> {
    try {
      const { temperature, similarityThreshold, maxRetrievalCount, enableAutoParse, systemPrompt } = req.body;

      let config = await this._getConfig();

      if (temperature !== undefined) config.temperature = temperature;
      if (similarityThreshold !== undefined) config.similarityThreshold = similarityThreshold;
      if (maxRetrievalCount !== undefined) config.maxRetrievalCount = maxRetrievalCount;
      if (enableAutoParse !== undefined) config.enableAutoParse = enableAutoParse ? 1 : 0;
      if (systemPrompt !== undefined) config.systemPrompt = systemPrompt;

      config = await AppDataSource.getRepository(CsConfig).save(config);

      return successResponse(res, null, '保存配置成功');
    } catch (error) {
      logger.error('保存 CS 配置失败:', error);
      return errorResponse(res, 500, '保存配置失败', null);
    }
  }

  // ========== 知识库选项（供沙箱选择用） ==========

  async getKbOptions(_req: Request, res: Response): Promise<Response> {
    try {
      const items = await AppDataSource.getRepository(KnowledgeBase).find({
        where: { isDeleted: 0, status: 1 },
        select: ['id', 'name'],
        order: { id: 'ASC' },
      });
      return successResponse(res, items, '获取知识库选项成功');
    } catch (error) {
      logger.error('获取知识库选项失败:', error);
      return errorResponse(res, 500, '获取知识库选项失败', null);
    }
  }

  // ========== 内部方法 ==========

  private async _getConfig(): Promise<CsConfig> {
    const repo = AppDataSource.getRepository(CsConfig);
    let config = await repo.findOne({ where: { id: 1 } });
    if (!config) {
      // 初始化默认配置
      config = new CsConfig();
      config.id = 1;
      config.temperature = 0.3;
      config.similarityThreshold = 0.45;
      config.maxRetrievalCount = 3;
      config.enableAutoParse = 1;
      config.systemPrompt = DEFAULT_SYSTEM_PROMPT;
      config = await repo.save(config);
    }
    return config;
  }
}

