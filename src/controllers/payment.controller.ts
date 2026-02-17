import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto, UpdatePaymentDto } from '../dtos/payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: any) {
    return {
      code: 200,
      message: '查询成功',
      data: await this.paymentService.findAll(query)
    };
  }

  @Get('unpaid-summary')
  async getUnpaidSummary(@Query() query: any) {
    return {
      code: 200,
      message: '未缴汇总查询成功',
      data: await this.paymentService.getUnpaidSummary(query)
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const payment = await this.paymentService.findOne(+id);
    if (!payment) {
      return {
        code: 404,
        message: '缴费记录不存在',
        data: null
      };
    }
    return {
      code: 200,
      message: '查询成功',
      data: payment
    };
  }

  @Post()
  @UsePipes(new ValidationPipe())
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    try {
      const payment = await this.paymentService.create(createPaymentDto);
      return {
        code: 201,
        message: '创建成功',
        data: payment
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
  async update(@Param('id') id: string, @Body() updatePaymentDto: UpdatePaymentDto) {
    try {
      const payment = await this.paymentService.update(+id, updatePaymentDto);
      if (!payment) {
        return {
          code: 404,
          message: '缴费记录不存在',
          data: null
        };
      }
      return {
        code: 200,
        message: '更新成功',
        data: payment
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
      await this.paymentService.remove(+id);
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