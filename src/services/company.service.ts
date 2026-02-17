import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyInfo } from '../models/company-info.entity';
import { CreateCompanyDto, UpdateCompanyDto } from '../dtos/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanyInfo)
    private companyRepository: Repository<CompanyInfo>,
  ) {}

  async findAll(query: any) {
    const { page = 1, size = 10, ...filters } = query;
    const skip = (page - 1) * size;
    
    const [items, total] = await this.companyRepository.findAndCount({
      where: filters,
      skip,
      take: size,
      order: { createdAt: 'DESC' }
    });

    return {
      items,
      total,
      page: parseInt(page),
      size: parseInt(size)
    };
  }

  async findOne(id: number) {
    return await this.companyRepository.findOne({ where: { id } });
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const company = this.companyRepository.create({
      ...createCompanyDto,
      createdBy: 'system',
      updatedBy: 'system'
    });
    return await this.companyRepository.save(company);
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto) {
    await this.companyRepository.update(id, {
      ...updateCompanyDto,
      updatedBy: 'system'
    });
    return await this.findOne(id);
  }

  async remove(id: number) {
    return await this.companyRepository.delete(id);
  }
}