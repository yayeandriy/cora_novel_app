import { TestBed } from '@angular/core/testing';
import { ProjectTimelineComponent } from './project-timeline.component';
import { TimelineService } from '../../services/timeline.service';
import { ChangeDetectorRef } from '@angular/core';
describe('ProjectTimelineComponent', () => {
    let component;
    let fixture;
    let mockTimelineService;
    let mockCdr;
    beforeEach(async () => {
        mockTimelineService = {
            getTimelineByEntity: jest.fn(),
            upsertTimeline: jest.fn(),
            createTimeline: jest.fn(),
            getTimeline: jest.fn(),
            listTimelines: jest.fn(),
            updateTimeline: jest.fn(),
            deleteTimeline: jest.fn(),
            deleteTimelineByEntity: jest.fn()
        };
        mockCdr = {
            markForCheck: jest.fn(),
            detach: jest.fn(),
            detectChanges: jest.fn(),
            checkNoChanges: jest.fn(),
            reattach: jest.fn()
        };
        await TestBed.configureTestingModule({
            imports: [ProjectTimelineComponent],
            providers: [
                { provide: TimelineService, useValue: mockTimelineService },
                { provide: ChangeDetectorRef, useValue: mockCdr }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(ProjectTimelineComponent);
        component = fixture.componentInstance;
    });
    it('should create', () => {
        expect(component).toBeTruthy();
    });
    describe('ngOnInit', () => {
        it('should load timeline on init', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockTimelineService.getTimelineByEntity.mockResolvedValue(mockTimeline);
            component.projectId = 123;
            await component.ngOnInit();
            expect(mockTimelineService.getTimelineByEntity).toHaveBeenCalledWith('project', 123);
            expect(component.startDate).toBe('2025-01-01');
            expect(component.endDate).toBe('2025-12-31');
        });
        it('should not load timeline if projectId is not set', async () => {
            component.projectId = undefined;
            await component.ngOnInit();
            expect(mockTimelineService.getTimelineByEntity).not.toHaveBeenCalled();
        });
    });
    describe('formatDateString', () => {
        it('should format valid date string', () => {
            const result = component.formatDateString('2025-01-15T00:00:00Z');
            expect(result).toBe('2025-01-15');
        });
        it('should return empty string for null', () => {
            const result = component.formatDateString(null);
            expect(result).toBe('');
        });
        it('should return empty string for invalid date', () => {
            const result = component.formatDateString('invalid-date');
            expect(result).toBe('');
        });
    });
    describe('onStartDateChange', () => {
        it('should emit start date change and save timeline', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-15',
                end_date: '2025-12-31'
            };
            mockTimelineService.upsertTimeline.mockResolvedValue(mockTimeline);
            component.projectId = 123;
            component.endDate = '2025-12-31';
            const startDateChangeSpy = jest.fn();
            component.startDateChange.subscribe(startDateChangeSpy);
            component.onStartDateChange('2025-01-15');
            expect(startDateChangeSpy).toHaveBeenCalledWith('2025-01-15');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockTimelineService.upsertTimeline).toHaveBeenCalledWith('project', 123, '2025-01-15', '2025-12-31');
        });
    });
    describe('onEndDateChange', () => {
        it('should emit end date change and save timeline', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockTimelineService.upsertTimeline.mockResolvedValue(mockTimeline);
            component.projectId = 123;
            component.startDate = '2025-01-01';
            const endDateChangeSpy = jest.fn();
            component.endDateChange.subscribe(endDateChangeSpy);
            component.onEndDateChange('2025-12-31');
            expect(endDateChangeSpy).toHaveBeenCalledWith('2025-12-31');
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(mockTimelineService.upsertTimeline).toHaveBeenCalledWith('project', 123, '2025-01-01', '2025-12-31');
        });
    });
    describe('getTicks', () => {
        it('should return empty array when no dates are set', () => {
            component.startDate = null;
            component.endDate = null;
            const ticks = component.getTicks();
            expect(ticks).toEqual([]);
        });
        it('should return empty array when start date is after end date', () => {
            component.startDate = '2025-12-31';
            component.endDate = '2025-01-01';
            const ticks = component.getTicks();
            expect(ticks).toEqual([]);
        });
        it('should generate ticks for a multi-year timeline', () => {
            component.startDate = '2023-01-01';
            component.endDate = '2026-12-31';
            const ticks = component.getTicks();
            expect(ticks.length).toBeGreaterThan(0);
            // Should have year ticks
            const yearTicks = ticks.filter(t => t.type === 'year');
            expect(yearTicks.length).toBeGreaterThan(0);
        });
        it('should generate ticks for a single-year timeline', () => {
            component.startDate = '2025-01-01';
            component.endDate = '2025-12-31';
            const ticks = component.getTicks();
            expect(ticks.length).toBeGreaterThan(0);
            // Should have month ticks
            const monthTicks = ticks.filter(t => t.type === 'month');
            expect(monthTicks.length).toBeGreaterThan(0);
        });
        it('should generate ticks within 0-100% position range', () => {
            component.startDate = '2025-01-01';
            component.endDate = '2025-12-31';
            const ticks = component.getTicks();
            ticks.forEach(tick => {
                expect(tick.position).toBeGreaterThanOrEqual(0);
                expect(tick.position).toBeLessThanOrEqual(100);
            });
        });
    });
    describe('formatTick', () => {
        it('should format year tick', () => {
            const date = new Date('2025-06-15');
            const result = component.formatTick(date, 'year');
            expect(result).toBe('2025');
        });
        it('should format month tick', () => {
            const date = new Date('2025-06-15');
            const result = component.formatTick(date, 'month');
            expect(result).toBe('Jun 2025');
        });
        it('should format quarter tick', () => {
            const date = new Date('2025-06-15');
            const result = component.formatTick(date, 'quarter');
            expect(result).toBe('Q2 2025');
        });
        it('should format day tick', () => {
            const date = new Date('2025-06-15');
            const result = component.formatTick(date, 'day');
            expect(result).toBe('6/15');
        });
    });
});
