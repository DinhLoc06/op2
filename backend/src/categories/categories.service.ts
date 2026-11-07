import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { Category } from './entities/category.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
  ) {}

  findAll(): Promise<Category[]> {
    return this.categoriesRepository.find({ order: { id: 'ASC' } });
  }

  async findProducts(id: number): Promise<Product[]> {
    await this.findOne(id);
    return this.productsRepository.find({
      where: { categoryId: id },
      relations: { category: true },
      order: { id: 'ASC' },
    });
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create(createCategoryDto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    const productCount = await this.productsRepository.count({
      where: { categoryId: id },
      withDeleted: true,
    });

    if (productCount > 0) {
      throw new ConflictException(
        'Không thể xóa danh mục đang được sản phẩm sử dụng',
      );
    }

    await this.categoriesRepository.remove(category);
  }

  private async findOne(id: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục có ID ${id}`);
    }

    return category;
  }
}
