import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { TranslationKeyPath } from '@assets/i18n/translation-keys';
import { Observable } from 'rxjs';

@Pipe({
  name: 'translate',
  standalone: true
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: TranslationKeyPath, params?: { [key: string]: any }): Observable<string> {
    return this.translationService.get(key, params);
  }
}