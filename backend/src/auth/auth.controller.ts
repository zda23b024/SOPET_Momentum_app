import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ConfirmMfaDto, ForgotPasswordDto, ResendVerificationDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { Public } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) {}

  private authCookieOptions(maxAge: number) {
    return { httpOnly: true, secure: this.config.get<boolean>('cookie.secure'), sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookie.sameSite'), path: '/', maxAge } as const;
  }

  private clearAuthCookies(res: Response) {
    const options = { httpOnly: true, secure: this.config.get<boolean>('cookie.secure'), sameSite: this.config.get<'lax' | 'strict' | 'none'>('cookie.sameSite'), path: '/' } as const;
    res.clearCookie('accessToken', options); res.clearCookie('refreshToken', options);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    return this.authService.verifyEmail(dto.token, req.ip || req.socket.remoteAddress, req.headers['user-agent']);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    return this.authService.resendVerification(dto.email, req.ip || req.socket.remoteAddress);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.email, req.ip || req.socket.remoteAddress);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return this.authService.resetPassword(dto.token, dto.newPassword, req.ip || req.socket.remoteAddress, req.headers['user-agent']);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new SOPET participant account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.register(dto, ip, userAgent);

    // Set secure HttpOnly cookies where appropriate
    if ('accessToken' in result && result.accessToken) {
      const tokenResult = result as typeof result & { accessToken: string; refreshToken: string };
      res.cookie('accessToken', tokenResult.accessToken, this.authCookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', tokenResult.refreshToken, this.authCookieOptions(7 * 24 * 60 * 60 * 1000));
      const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = tokenResult;
      return safeResult;
    }
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password (Argon2id)' })
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, userAgent);

    if ('accessToken' in result && result.accessToken) {
      res.cookie('accessToken', result.accessToken, this.authCookieOptions(15 * 60 * 1000));
      res.cookie('refreshToken', result.refreshToken, this.authCookieOptions(7 * 24 * 60 * 60 * 1000));
    }

    if ('accessToken' in result) {
      const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = result;
      return safeResult;
    }
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and obtain new access token' })
  async refresh(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (body && Object.prototype.hasOwnProperty.call(body, 'refreshToken')) {
      throw new BadRequestException('Refresh credentials are accepted only from the HttpOnly cookie');
    }
    const token = req.cookies?.['refreshToken'];
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.refreshToken(token, ip, userAgent);

    res.cookie('accessToken', result.accessToken, this.authCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', result.refreshToken, this.authCookieOptions(7 * 24 * 60 * 60 * 1000));

    const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeResult } = result;
    return safeResult;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out current session and revoke tokens' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookies(res);
    return await this.authService.logout(user?.sessionId, user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all active sessions for current user' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearAuthCookies(res);
    return await this.authService.logoutAllSessions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get profile and permissions for currently authenticated user' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        privacyMode: user.privacyMode,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enroll')
  async beginMfaEnrollment(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.beginMfaEnrollment(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/confirm')
  async confirmMfaEnrollment(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmMfaDto) {
    return this.authService.confirmMfaEnrollment(user.id, dto.totpCode);
  }

}
