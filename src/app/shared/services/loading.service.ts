import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LoadingState {
  show: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<LoadingState>({ show: false });
  private requestCount = 0;

  /**
   * Get observable of loading state
   */
  get loading$(): Observable<LoadingState> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Show the loading spinner
   * @param message Optional message to display
   */
  show(message = 'Loading...'): void {
    this.requestCount++;
    this.loadingSubject.next({ show: true, message });
  }

  /**
   * Hide the loading spinner
   */
  hide(): void {
    this.requestCount--;
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.loadingSubject.next({ show: false });
    }
  }

  /**
   * Set a new message without changing visibility
   * @param message The message to display
   */
  setMessage(message: string): void {
    const currentState = this.loadingSubject.value;
    this.loadingSubject.next({ ...currentState, message });
  }

  /**
   * Reset the loading state and counter
   */
  reset(): void {
    this.requestCount = 0;
    this.loadingSubject.next({ show: false });
  }
}