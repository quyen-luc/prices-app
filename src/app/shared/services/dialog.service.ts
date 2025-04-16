import {
  Injectable,
  ComponentFactoryResolver,
  ApplicationRef,
  Injector,
  EmbeddedViewRef,
  ComponentRef,
  Type,
} from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface DialogRef<T = any> {
  title?: string;
  message?: string;
  afterClosed: Observable<T>;
  close: (result?: T) => void;
  componentInstance: any;
}

@Injectable()
export class DialogService {
  private dialogComponentRef: ComponentRef<any> | null = null;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  /**
   * Opens a component in a dialog modal
   * @param component The component to display in the dialog
   * @param data Optional data to pass to the component
   * @returns A DialogRef object that can be used to control and get results from the dialog
   */
  open<T, R = any>(component: Type<T>, data?: any): DialogRef<R> {
    // Close any existing dialog
    this.close();

    // Create result subject
    const afterClosedSubject = new Subject<R>();

    // Create component
    const componentFactory =
      this.componentFactoryResolver.resolveComponentFactory(component);
    const componentRef = componentFactory.create(this.injector);

    // Set dialog result handler
    // Look for any output property that might be used to close/return data
    const instance = componentRef.instance as any;

    const outputProps = ['dialogClose', 'close', 'confirm', 'complete'];

    // Find and subscribe to any available output
    for (const prop of outputProps) {
      if (instance[prop] && typeof instance[prop].subscribe === 'function') {
        instance[prop].subscribe((result: R) => {
          this.closeDialog();
          afterClosedSubject.next(result);
          afterClosedSubject.complete();
        });
        break;
      }
    }

    // Pass input data to component if provided
    if (data) {
      const inputProps = ['data'];

      // Find and set the first available input prop
      for (const prop of inputProps) {
        instance[prop] = data;
      }
    }

    // Attach to application
    this.appRef.attachView(componentRef.hostView);

    // Get DOM element
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>)
      .rootNodes[0] as HTMLElement;

    // Create backdrop
    const backdropElement = document.createElement('div');
    backdropElement.className = 'dialog-backdrop';

    // Create dialog container
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'dialog-container';

    // Add ESC key handler to close dialog
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeDialog();
        afterClosedSubject.next(null);
        afterClosedSubject.complete();
      }
    };
    document.addEventListener('keydown', handleEscKey);

    // Store reference for closing
    this.dialogComponentRef = componentRef;
    this.dialogComponentRef.onDestroy(() => {
      document.removeEventListener('keydown', handleEscKey);
    });

    // Add click handler to backdrop for closing
    backdropElement.addEventListener('click', (event) => {
      if (event.target === backdropElement) {
        this.closeDialog();
        afterClosedSubject.next(null);
        afterClosedSubject.complete();
      }
    });

    // Append elements to DOM
    dialogContainer.appendChild(domElem);
    backdropElement.appendChild(dialogContainer);
    document.body.appendChild(backdropElement);

    // Add the CSS class to prevent scrolling on the body
    document.body.classList.add('dialog-open');

    // Create DialogRef object to return
    const dialogRef: DialogRef<R> = {
      afterClosed: afterClosedSubject.asObservable(),
      close: (result?: R) => {
        this.closeDialog();
        afterClosedSubject.next(result);
        afterClosedSubject.complete();
      },
      componentInstance: instance,
    };

    return dialogRef;
  }

  /**
   * Closes the active dialog
   */
  private closeDialog(): void {
    if (this.dialogComponentRef) {
      this.appRef.detachView(this.dialogComponentRef.hostView);
      this.dialogComponentRef.destroy();
      this.dialogComponentRef = null;

      // Remove backdrop elements
      const backdrop = document.querySelector('.dialog-backdrop');
      if (backdrop) {
        document.body.removeChild(backdrop);
      }

      // Remove the body class
      document.body.classList.remove('dialog-open');
    }
  }

  /**
   * Public method to forcibly close any open dialog
   */
  close(): void {
    this.closeDialog();
  }

  /**
   * Opens a confirmation dialog with the specified message
   * @param title Dialog title
   * @param message Dialog message
   * @param options Optional configuration options
   * @returns DialogRef with boolean result (true for confirm, false for cancel)
   */
  //   confirm(title: string, message: string, options: {
  //     confirmText?: string;
  //     cancelText?: string;
  //     confirmColor?: string;
  //   } = {}): DialogRef<boolean> {
  //     // This would use a built-in confirmation dialog component
  //     // Just a placeholder - you would implement this separately
  //     return this.open(/* ConfirmationDialogComponent */, {
  //       title,
  //       message,
  //       confirmText: options.confirmText || 'Confirm',
  //       cancelText: options.cancelText || 'Cancel',
  //       confirmColor: options.confirmColor || 'primary'
  //     });
  //   }
}
