import { AppDataSource } from '../config/database';
import { ImageProcessorController } from '../controllers/image-processor.controller';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function main() {
  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    logger.info('数据库连接已建立');
    
    // 创建控制器实例
    const imageProcessor = new ImageProcessorController();
    
    // 执行图片处理
    await imageProcessor.processImages();
    
    // 关闭数据库连接
    await AppDataSource.destroy();
    logger.info('数据库连接已关闭');
    
    process.exit(0);
  } catch (error) {
    logger.error(`脚本执行失败: ${error}`);
    process.exit(1);
  }
}

// 执行主函数
main();