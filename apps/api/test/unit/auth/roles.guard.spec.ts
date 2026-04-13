import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';
import { ROLES_KEY } from '../../../src/auth/decorators/roles.decorator';
import { UserRole } from '@dealscrapper/shared-types';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockExecutionContext = (user?: { role: string }): ExecutionContext => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no @Roles() metadata is set', () => {
    const context = createMockExecutionContext({ role: UserRole.USER });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when @Roles() has empty array', () => {
    const context = createMockExecutionContext({ role: UserRole.USER });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    const context = createMockExecutionContext({ role: UserRole.ADMIN });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user lacks the required role', () => {
    const context = createMockExecutionContext({ role: UserRole.USER });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny access when no user is on the request', () => {
    const context = createMockExecutionContext(undefined);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access when user has one of multiple required roles', () => {
    const context = createMockExecutionContext({ role: UserRole.ADMIN });
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER, UserRole.ADMIN]);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should use correct metadata key from ROLES_KEY', () => {
    const context = createMockExecutionContext({ role: UserRole.USER });
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    guard.canActivate(context);

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
