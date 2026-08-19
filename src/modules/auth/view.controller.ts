import { Controller, Get, Query, Render } from '@nestjs/common';

@Controller()
export class ViewController {
  @Get('login')
  @Render('login')
  login(@Query('error') error?: string) {
    return { error };
  }
}