import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { Address } from './entities/address.entity.js';
import { AddressesController } from './addresses.controller.js';
import { AddressesService } from './addresses.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Address]), AuditLogsModule],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
