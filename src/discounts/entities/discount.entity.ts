import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('discounts')
export class Discount {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 100 })
    name: string;

    @Column({ type: 'float' })
    percentage: number;

    @Column({ default: true })
    active: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;
}
