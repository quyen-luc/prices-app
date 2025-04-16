// src/shared/entities/product.entity.ts
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  partNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
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

  @Column()
  currencyCode: string;

  @Column('decimal', { precision: 10, scale: 2 })
  netPrice: number;
   
  @Column({ nullable: true})
  changeDate: Date;

  @Column({ default: true })
  isModifiedLocally: boolean;

  @Column({ nullable: true })
  lastSyncedAt: Date;

  @Column('varchar', { length: 255 })
  priceListId: string;

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}


