import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class StartTimerDto {
  @ApiProperty({
    description: 'Timer duration in seconds',
    minimum: 1,
    example: 1800,
  })
  @IsInt()
  @Min(1)
  durationSeconds: number;
}
