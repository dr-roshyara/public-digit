import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { TranslationKeyPath } from '@assets/i18n/translation-keys';

@Pipe({
  name: 'translateSync',
  standalone: true
})
export class TranslateSyncPipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: TranslationKeyPath, params?: { [key: string]: any }): string {
    return this.translationService.getSync(key, params);
  }
}