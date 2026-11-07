import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';
import { UpdateAddressDto } from './dto/update-address.dto.js';
import { Address } from './entities/address.entity.js';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address) private readonly addresses: Repository<Address>,
    private readonly audit: AuditLogsService,
  ) {}

  findAll(userId: number) {
    return this.addresses.find({ where: { userId }, order: { id: 'ASC' } });
  }

  async create(userId: number, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.addresses.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }
    const address = await this.addresses.save(
      this.addresses.create({
        receiverName: dto.receiverName,
        receiverPhone: dto.receiverPhone,
        addressLine: dto.addressLine,
        ward: dto.ward,
        district: dto.district,
        province: dto.province,
        isDefault: dto.isDefault ?? false,
        userId,
      }),
    );
    await this.audit.record(userId, 'ADDRESS_CREATED', 'Address', address.id);
    return address;
  }

  async update(userId: number, id: number, dto: UpdateAddressDto) {
    const address = await this.getOwned(userId, id);
    if (dto.isDefault) {
      await this.addresses.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }
    Object.assign(address, dto);
    const saved = await this.addresses.save(address);
    await this.audit.record(userId, 'ADDRESS_UPDATED', 'Address', id);
    return saved;
  }

  async remove(userId: number, id: number) {
    const address = await this.getOwned(userId, id);
    await this.addresses.remove(address);
    await this.audit.record(userId, 'ADDRESS_DELETED', 'Address', id);
    return { message: 'Đã xóa địa chỉ' };
  }

  async getOwned(userId: number, id: number): Promise<Address> {
    const address = await this.addresses.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Không tìm thấy địa chỉ');
    return address;
  }
}
