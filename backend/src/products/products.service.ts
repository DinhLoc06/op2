import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsOrder,
  FindOptionsWhere,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto.js';
import { FindProductsQueryDto } from './dto/find-products-query.dto.js';
import { StockDto } from './dto/stock.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Product } from './entities/product.entity.js';
import { Category } from '../categories/entities/category.entity.js';

export interface ProductListResponse {
  data: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: FindProductsQueryDto): Promise<ProductListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: FindOptionsWhere<Product> = {};

    if (query.name) {
      where.name = Like(`%${query.name}%`);
    }

    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      where.price = Between(query.minPrice, query.maxPrice);
    } else if (query.minPrice !== undefined) {
      where.price = MoreThanOrEqual(query.minPrice);
    } else if (query.maxPrice !== undefined) {
      where.price = LessThanOrEqual(query.maxPrice);
    }
    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    const direction = query.order ?? 'ASC';
    const [data, total] = await this.productsRepository.findAndCount({
      where,
      relations: { category: true },
      order: this.getOrder(query.sort ?? 'id', direction),
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm có ID ${id}`);
    }

    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const category = await this.categoriesRepository.findOne({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Không tìm thấy danh mục có ID ${createProductDto.categoryId}`,
      );
    }

    const product = this.productsRepository.create();
    product.name = createProductDto.name;
    product.price = createProductDto.price;
    product.description = createProductDto.description ?? null;
    product.categoryId = category.id;
    product.category = category;
    product.quantity = createProductDto.quantity;
    return this.productsRepository.save(product);
  }

  async update(id: number, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);

    if (updateProductDto.name !== undefined) {
      product.name = updateProductDto.name;
    }
    if (updateProductDto.price !== undefined) {
      product.price = updateProductDto.price;
    }
    if (updateProductDto.description !== undefined) {
      product.description = updateProductDto.description;
    }
    if (updateProductDto.categoryId !== undefined) {
      const category = await this.categoriesRepository.findOne({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(
          `Không tìm thấy danh mục có ID ${updateProductDto.categoryId}`,
        );
      }
      product.category = category;
      product.categoryId = category.id;
    }
    if (updateProductDto.quantity !== undefined) {
      product.quantity = updateProductDto.quantity;
    }

    return this.productsRepository.save(product);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.productsRepository.softDelete(id);
  }

  async restore(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      withDeleted: true,
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm có ID ${id}`);
    }
    if (!product.deletedAt) {
      throw new BadRequestException('Sản phẩm chưa bị xóa');
    }

    await this.productsRepository.restore(id);
    return this.findOne(id);
  }

  async stockIn(id: number, stockDto: StockDto): Promise<Product> {
    return this.changeStock(id, stockDto.quantity);
  }

  async stockOut(id: number, stockDto: StockDto): Promise<Product> {
    return this.changeStock(id, -stockDto.quantity);
  }

  private async changeStock(id: number, quantityChange: number): Promise<Product> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id },
        relations: { category: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!product) {
        throw new NotFoundException(`Không tìm thấy sản phẩm có ID ${id}`);
      }

      if (product.quantity + quantityChange < 0) {
        throw new BadRequestException('Không đủ số lượng tồn kho để xuất');
      }

      product.quantity += quantityChange;
      const updatedProduct = await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      return updatedProduct;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getOrder(
    sort: NonNullable<FindProductsQueryDto['sort']> | 'id',
    direction: 'ASC' | 'DESC',
  ): FindOptionsOrder<Product> {
    if (sort === 'category') {
      return { category: { name: direction } };
    }

    return { [sort]: direction };
  }
}
