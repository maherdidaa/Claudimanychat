import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtAccessPayload {
  sub: string; // user id
  email: string;
  workspaceId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  workspaceId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: payload.workspaceId, userId: payload.sub } },
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of this workspace');
    }

    return {
      id: payload.sub,
      email: payload.email,
      workspaceId: payload.workspaceId,
      role: membership.role,
    };
  }
}
