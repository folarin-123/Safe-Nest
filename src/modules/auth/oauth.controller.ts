import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from '../../common/guards/google-auth.guard';
import { FacebookAuthGuard } from '../../common/guards/facebook-auth.guard';

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() request: Request, @Res() response: Response) {
    return this.redirectWithToken(request, response);
  }

  @Get('facebook')
  @UseGuards(FacebookAuthGuard)
  facebookLogin() {}

  @Get('facebook/callback')
  @UseGuards(FacebookAuthGuard)
  facebookCallback(@Req() request: Request, @Res() response: Response) {
    return this.redirectWithToken(request, response);
  }

  private redirectWithToken(request: Request, response: Response) {
    const authResult = request.user as Awaited<ReturnType<AuthService['handleOAuthLogin']>>;
    const baseUrl = this.configService
      .getOrThrow<string>('APP_BASE_URL')
      .replace(/\/$/, '');

    response.redirect(
      `${baseUrl}/auth/callback?token=${encodeURIComponent(authResult.accessToken)}`,
    );
  }
}