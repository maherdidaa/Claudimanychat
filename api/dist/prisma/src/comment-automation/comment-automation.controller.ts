import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { CommentAutomationService } from './comment-automation.service';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

@UseGuards(JwtAuthGuard)
@Controller('comment-automations')
export class CommentAutomationController {
  constructor(private readonly service: CommentAutomationService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAutomationDto) {
    return this.service.create(user.workspaceId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('facebookPageId') facebookPageId?: string) {
    return this.service.findAll(user.workspaceId, facebookPageId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.workspaceId, id);
  }

  @Get(':id/logs')
  getLogs(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getExecutionLogs(user.workspaceId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.service.update(user.workspaceId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.workspaceId, id);
  }
}
