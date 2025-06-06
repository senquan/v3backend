import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from '../services/permission.service';
import { Permission } from '../models/permission.model';
import { AuthGuard } from '../guards/auth.guard';

@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  async findAll() {
    const permissions = await this.permissionService.findAll();
    return { code: 0, data: permissions, message: '获取权限列表成功' };
  }

  @Get('tree')
  async getPermissionTree() {
    const permissionTree = await this.permissionService.getPermissionTree();
    return { code: 0, data: permissionTree, message: '获取权限树成功' };
  }

  @Get(':id')
  async findById(@Param('id') id: number) {
    const permission = await this.permissionService.findById(id);
    return { code: 0, data: permission, message: '获取权限详情成功' };
  }

  @Post()
  async create(@Body() permission: Partial<Permission>) {
    const newPermission = await this.permissionService.create(permission);
    return { code: 0, data: newPermission, message: '创建权限成功' };
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() permission: Partial<Permission>) {
    const updatedPermission = await this.permissionService.update(id, permission);
    return { code: 0, data: updatedPermission, message: '更新权限成功' };
  }

  @Delete(':id')
  async delete(@Param('id') id: number) {
    await this.permissionService.delete(id);
    return { code: 0, data: null, message: '删除权限成功' };
  }
}