import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CommentReplyMode } from '@prisma/client';

export class CreateAutomationDto {
  @IsUUID()
  facebookPageId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsEnum(CommentReplyMode)
  replyMode!: CommentReplyMode;

  @ValidateIf((o) => o.replyMode === CommentReplyMode.SPECIFIC_KEYWORDS)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  matchKeywords?: string[] = [];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  ignoreKeywords?: string[] = [];

  @IsOptional()
  @IsBoolean()
  replyOncePerUser?: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  delaySeconds?: number = 0;

  @IsOptional()
  @IsBoolean()
  likeComment?: boolean = false;

  @IsOptional()
  @IsBoolean()
  hideComment?: boolean = false;

  @IsOptional()
  @IsBoolean()
  deleteComment?: boolean = false;

  @IsOptional()
  @IsBoolean()
  publicReplyEnabled?: boolean = true;

  @ValidateIf((o) => o.publicReplyEnabled)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  publicReplyText?: string;

  @IsOptional()
  @IsBoolean()
  sendMessengerMessage?: boolean = false;

  @ValidateIf((o) => o.sendMessengerMessage)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  messengerMessageText?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assignTagIds?: string[] = [];

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown> = {};

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  scheduleStartAt?: string;

  @IsOptional()
  @IsDateString()
  scheduleEndAt?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  activeDaysOfWeek?: number[] = [0, 1, 2, 3, 4, 5, 6];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHourStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  activeHourEnd?: number;
}
