// src/shared/entities/product.entity.ts
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
} from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  partNumber: string;

  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column()
  licenseAgreementType: string;

  @Column()
  programName: string;

  @Column()
  offeringName: string;

  @Column({ nullable: true })
  level: string;

  @Column()
  purchaseUnit: string;

  @Column()
  purchasePeriod: string;

  @Column()
  productFamily: string;

  @Column()
  productType: string;

  @Column('decimal', { precision: 10, scale: 2 })
  netPrice: number;

  @Column()
  currencyCode: string;

  @Column({ nullable: true, type: 'timestamp' })
  changeDate: Date;

  @Column({ nullable: true })
  lastSyncedAt: Date;

  @Column({ default: 1 })
  version: number;

  @Column({ type: 'text', array: true, nullable: true })
  syncedIds: string[];

  @Column('varchar', { length: 255})
  priceListId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
