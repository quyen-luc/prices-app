import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { LoadingSpinnerComponent, PageNotFoundComponent } from './components/';
import { WebviewDirective } from './directives/';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RootLoadingComponent } from './components/root-loading/root-loading.component';
import { NotificationToastComponent } from './components/notification-toast/notification-toast.component';
import { AutocompleteDropdownComponent } from './components/auto-complete-dropdown/autocomplete-dropdown.component';
import { ClickOutsideDirective } from './directives/click-outside/click-outside.directive';

@NgModule({
  declarations: [
    PageNotFoundComponent,
    WebviewDirective,
    LoadingSpinnerComponent,
    RootLoadingComponent,
    NotificationToastComponent,
    AutocompleteDropdownComponent,
    ClickOutsideDirective
  ],
  imports: [CommonModule, TranslateModule, FormsModule, ReactiveFormsModule],
  exports: [
    TranslateModule,
    WebviewDirective,
    FormsModule,
    LoadingSpinnerComponent,
    RootLoadingComponent,
    NotificationToastComponent,
    AutocompleteDropdownComponent,
    ClickOutsideDirective
  ],
})
export class SharedModule {}
