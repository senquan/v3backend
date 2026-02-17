import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { DepositService } from '../services/deposit.service';
import { CreateDepositDto, UpdateDepositDto } from '../dtos/deposit.dto';

@Controller('deposits')
export class DepositController {
  constructor(private readonly depositService: DepositService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: any) {
    return {
      code: 200,
      message: '查询成功',
      data: await this.depositService.findAll(query)
    };
  }

  @Get('statistics')
  async getStatistics(@Query() query: any) {
    return {
      code: 200,
      message: '统计查询成功',
      data: await this.depositService.getStatistics(query)
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const deposit = await this.depositService.findOne(+id);
    if (!deposit) {
      return {
        code: 404,
        message: '存款记录不存在',
        data: null
      };
    }
    return {
      code: 200,
      message: '查询成功',
      data: deposit
    };
  }

  @Post()
  @UsePipes(new ValidationPipe())
  async create(@Body() createDepositDto: CreateDepositDto) {
    try {
      const deposit = await this.depositService.create(createDepositDto);
      return {
        code: 201,
        message: '创建成功',
        data: deposit
      };
    } catch (error) {
      return {
        code: 400,
        message: '创建失败: ' + error.message,
        data: null
      };
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe())
  async update(@Param('id') id: string, @Body() updateDepositDto: UpdateDepositDto) {
    try {
      const deposit = await this.depositService.update(+id, updateDepositDto);
      if (!deposit) {
        return {
          code: 404,
          message: '存款记录不存在',
          data: null
        };
      }
      return {
        code: 200,
        message: '更新成功',
        data: deposit
      };
    } catch (error) {
      return {
        code: 400,
        message: '更新失败: ' + error.message,
        data: null
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.depositService.remove(+id);
      return {
        code: 200,
        message: '删除成功',
        data: null
      };
    } catch (error) {
      return {
        code: 400,
        message: '删除失败: ' + error.message,
        data: null
      };
    }
  }
}