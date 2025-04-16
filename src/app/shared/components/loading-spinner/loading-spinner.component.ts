import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent implements OnInit {
  @Input() show = false;
  @Input() message = 'Loading...';
  @Input() transparent = false;
  @Input() fullscreen = true;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  constructor() { }

  ngOnInit(): void { }
}