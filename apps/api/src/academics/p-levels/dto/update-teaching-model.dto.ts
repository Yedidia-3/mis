import { IsIn } from 'class-validator';

export class UpdateTeachingModelDto {
  @IsIn(['class_teacher', 'specialist'], {
    message: 'teaching_model must be class_teacher or specialist',
  })
  teaching_model: 'class_teacher' | 'specialist';
}
