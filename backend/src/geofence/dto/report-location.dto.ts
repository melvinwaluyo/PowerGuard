import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber, IsOptional } from 'class-validator';

export class ReportLocationDto {
  @ApiProperty({ description: 'Latitude pengguna', example: -7.770959 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ description: 'Longitude pengguna', example: 110.377571 })
  @IsLongitude()
  longitude: number;

  @ApiProperty({
    description: 'Akurasi lokasi dalam meter',
    required: false,
    example: 25,
  })
  @IsOptional()
  @IsNumber()
  accuracy?: number;
}
