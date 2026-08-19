import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('FACEBOOK_APP_ID'),
      clientSecret: configService.getOrThrow<string>('FACEBOOK_APP_SECRET'),
      callbackURL: configService.getOrThrow<string>('FACEBOOK_CALLBACK_URL'),
      // Request email and public_profile from Facebook
      profileFields: ['id', 'displayName', 'name', 'emails'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: unknown) => void,
  ) {
    try {
      const email = profile.emails?.[0]?.value;
      const fullName =
        profile.displayName ||
        `${(profile as any).name?.givenName ?? ''} ${(profile as any).name?.familyName ?? ''}`.trim() ||
        'Facebook User';

      const result = await this.authService.handleOAuthLogin({
        provider: 'facebook',
        providerId: profile.id,
        email: email ?? '',
        fullName,
      });

      done(null, result);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
