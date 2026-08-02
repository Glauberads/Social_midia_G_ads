import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { SubmitContentRequestUseCase } from './submit-content-request.use-case';

const command = { contentRequestId: '11111111-1111-4111-8111-111111111111', tenantId: '22222222-2222-4222-8222-222222222222', userId: '33333333-3333-4333-8333-333333333333', requestId: 'req-1' };

function createTx(status = 'DRAFT') {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: command.contentRequestId }]),
    contentRequest: {
      findFirst: jest.fn().mockResolvedValue({ id: command.contentRequestId, status }),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    contentGeneration: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'generation-1', status: 'QUEUED', idempotencyKey: `content-generation-${command.contentRequestId}-1` }),
      findFirst: jest.fn().mockResolvedValue(status === 'SUBMITTED' ? { id: 'generation-1', status: 'QUEUED', idempotencyKey: 'existing' } : null),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SubmitContentRequestUseCase', () => {
  const config = { get: jest.fn((key: string, fallback: unknown) => fallback) };

  it('creates one generation and enqueues a minimal job', async () => {
    const tx = createTx();
    const transaction = { execute: jest.fn((_scope, work) => work(tx)) };
    const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const useCase = new SubmitContentRequestUseCase(transaction as any, queue as any, config as any);
    await expect(useCase.execute(command)).resolves.toMatchObject({ generationId: 'generation-1', status: 'QUEUED', idempotent: false });
    expect(queue.enqueue).toHaveBeenCalledWith({ generationId: 'generation-1', tenantId: command.tenantId, contentRequestId: command.contentRequestId, requestedById: command.userId, requestId: command.requestId }, `content-generation-${command.contentRequestId}-1`);
  });

  it('returns the active generation on duplicate submit without a second enqueue', async () => {
    const tx = createTx('SUBMITTED');
    const queue = { enqueue: jest.fn() };
    const useCase = new SubmitContentRequestUseCase({ execute: jest.fn((_scope, work) => work(tx)) } as any, queue as any, config as any);
    await expect(useCase.execute(command)).resolves.toMatchObject({ generationId: 'generation-1', idempotent: true });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an invalid status transition', async () => {
    const tx = createTx('READY');
    const useCase = new SubmitContentRequestUseCase({ execute: jest.fn((_scope, work) => work(tx)) } as any, { enqueue: jest.fn() } as any, config as any);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ConflictException);
  });

  it('compensates database state when enqueue fails', async () => {
    const firstTx = createTx();
    const compensationTx = createTx('SUBMITTED');
    compensationTx.contentGeneration.findFirst.mockResolvedValue({ id: 'generation-1', status: 'QUEUED' });
    const transaction = { execute: jest.fn().mockImplementationOnce((_scope, work) => work(firstTx)).mockImplementationOnce((_scope, work) => work(compensationTx)) };
    const useCase = new SubmitContentRequestUseCase(transaction as any, { enqueue: jest.fn().mockRejectedValue(new Error('redis down')) } as any, config as any);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(compensationTx.contentGeneration.delete).toHaveBeenCalledWith({ where: { id: 'generation-1' } });
    expect(compensationTx.contentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DRAFT' } }));
  });
});
