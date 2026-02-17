import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ExpenseService } from '../services/expense.service';
import { CreateExpenseDto, UpdateExpenseDto } from '../dtos/expense.dto';

@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: any) {
    return {
      code: 200,
      message: '查询成功',
      data: await this.expenseService.findAll(query)
    };
  }

  @Get('summary')
  async getSummary(@Query() query: any) {
    return {
      code: 200,
      message: '汇总查询成功',
      data: await this.expenseService.getSummary(query)
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const expense = await this.expenseService.findOne(+id);
    if (!expense) {
      return {
        code: 404,
        message: '费用记录不存在',
        data: null
      };
    }
    return {
      code: 200,
      message: '查询成功',
      data: expense
    };
  }

  @Post()
  @UsePipes(new ValidationPipe())
  async create(@Body() createExpenseDto: CreateExpenseDto) {
    try {
      const expense = await this.expenseService.create(createExpenseDto);
      return {
        code: 201,
        message: '创建成功',
        data: expense
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
  async update(@Param('id') id: string, @Body() updateExpenseDto: UpdateExpenseDto) {
    try {
      const expense = await this.expenseService.update(+id, updateExpenseDto);
      if (!expense) {
        return {
          code: 404,
          message: '费用记录不存在',
          data: null
        };
      }
      return {
        code: 200,
        message: '更新成功',
        data: expense
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
      await this.expenseService.remove(+id);
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