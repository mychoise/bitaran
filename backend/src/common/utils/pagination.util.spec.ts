import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PaginationQueryDto } from '../dto/pagination.dto.js';
import { buildPaginatedResult, getOffset } from './pagination.util.js';

const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(PaginationQueryDto, query);
  return { dto, errors: validateSync(dto) };
};

describe('pagination', () => {
  it('defaults to page 1, limit 20', () => {
    const { dto, errors } = parse({});
    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });

  it('converts query strings to numbers', () => {
    expect(parse({ page: '3', limit: '50' }).dto).toMatchObject({
      page: 3,
      limit: 50,
    });
  });

  it.each([
    { limit: '101' },
    { limit: '0' },
    { page: '0' },
    { page: '1.5' },
    { page: 'x' },
  ])('rejects %p', (query) => {
    expect(parse(query).errors.length).toBeGreaterThan(0);
  });

  it('computes offsets and the list envelope', () => {
    expect(getOffset({ page: 3, limit: 20 })).toBe(40);
    expect(buildPaginatedResult(['a'], 41, { page: 3, limit: 20 })).toEqual({
      data: ['a'],
      page: 3,
      limit: 20,
      total: 41,
    });
  });
});
