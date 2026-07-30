import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../application/ports/unit-of-work';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return await work(tx);
    });
  }
}
