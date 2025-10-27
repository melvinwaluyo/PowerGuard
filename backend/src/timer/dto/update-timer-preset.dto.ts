import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTimerPresetDto {
  @ApiProperty({
    description: 'Durasi default timer dalam detik',
    minimum: 1,
    example: 900,
  })
  @IsInt()
  @Min(1)
  durationSeconds: number;
}
