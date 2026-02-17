import { Controller, Get, Post, Put, Delete, Param, Body, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { CompanyService } from '../services/company.service';
import { CreateCompanyDto, UpdateCompanyDto } from '../dtos/company.dto';

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(@Query() query: any) {
    return {
      code: 200,
      message: '查询成功',
      data: await this.companyService.findAll(query)
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.companyService.findOne(+id);
    if (!company) {
      return {
        code: 404,
        message: '单位不存在',
        data: null
      };
    }
    return {
      code: 200,
      message: '查询成功',
      data: company
    };
  }

  @Post()
  @UsePipes(new ValidationPipe())
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    try {
      const company = await this.companyService.create(createCompanyDto);
      return {
        code: 201,
        message: '创建成功',
        data: company
      };
    } catch (error) {
      return {
        code: 400,
        message: '创建失败: ' + (error as Error).message,
        data: null
      };
    }
  }

  @Put(':id')
  @UsePipes(new ValidationPipe())
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    try {
      const company = await this.companyService.update(+id, updateCompanyDto);
      if (!company) {
        return {
          code: 404,
          message: '单位不存在',
          data: null
        };
      }
      return {
        code: 200,
        message: '更新成功',
        data: company
      };
    } catch (error) {
      return {
        code: 400,
        message: '更新失败: ' + (error as Error).message,
        data: null
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.companyService.remove(+id);
      return {
        code: 200,
        message: '删除成功',
        data: null
      };
    } catch (error) {
      return {
        code: 400,
        message: '删除失败: ' + (error as Error).message,
        data: null
      };
    }
  }
}