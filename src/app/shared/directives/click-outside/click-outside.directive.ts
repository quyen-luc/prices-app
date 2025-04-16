import { Directive, ElementRef, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[clickOutside]'
})
export class ClickOutsideDirective implements OnInit, OnDestroy {
  @Output() clickOutside = new EventEmitter<MouseEvent>();
  
  private handleClickBound: (event: MouseEvent) => void;

  constructor(private elementRef: ElementRef) {
    // Create bound function to ensure we can remove the same listener later
    this.handleClickBound = this.handleClick.bind(this);
  }
  
  ngOnInit(): void {
    // Add listener in capture phase (true parameter) 
    // This is critical for Electron as it catches events earlier
    setTimeout(() => {
      document.addEventListener('click', this.handleClickBound, true);
    });
  }
  
  ngOnDestroy(): void {
    // Clean up the event listener
    document.removeEventListener('click', this.handleClickBound, true);
  }
  
  private handleClick(event: MouseEvent): void {
    const targetElement = event.target as HTMLElement;
    
    // Check if the click was outside the element
    if (targetElement && !this.elementRef.nativeElement.contains(targetElement)) {
      this.clickOutside.emit(event);
    }
  }
}