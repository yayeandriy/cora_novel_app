import { TestBed } from '@angular/core/testing';
import { TimelineService } from './timeline.service';
// Mock Tauri invoke function
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
    invoke: (...args) => mockInvoke(...args)
}));
describe('TimelineService', () => {
    let service;
    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(TimelineService);
        mockInvoke.mockClear();
    });
    it('should be created', () => {
        expect(service).toBeTruthy();
    });
    describe('createTimeline', () => {
        it('should create a timeline', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockInvoke.mockResolvedValue(mockTimeline);
            const result = await service.createTimeline({
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            });
            expect(mockInvoke).toHaveBeenCalledWith('timeline_create', {
                payload: {
                    entity_type: 'project',
                    entity_id: 123,
                    start_date: '2025-01-01',
                    end_date: '2025-12-31'
                }
            });
            expect(result).toEqual(mockTimeline);
        });
    });
    describe('getTimeline', () => {
        it('should get a timeline by id', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockInvoke.mockResolvedValue(mockTimeline);
            const result = await service.getTimeline(1);
            expect(mockInvoke).toHaveBeenCalledWith('timeline_get', { id: 1 });
            expect(result).toEqual(mockTimeline);
        });
        it('should return null when timeline not found', async () => {
            mockInvoke.mockResolvedValue(null);
            const result = await service.getTimeline(999);
            expect(result).toBeNull();
        });
    });
    describe('getTimelineByEntity', () => {
        it('should get a timeline by entity type and id', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockInvoke.mockResolvedValue(mockTimeline);
            const result = await service.getTimelineByEntity('project', 123);
            expect(mockInvoke).toHaveBeenCalledWith('timeline_get_by_entity', {
                entityType: 'project',
                entityId: 123
            });
            expect(result).toEqual(mockTimeline);
        });
    });
    describe('listTimelines', () => {
        it('should list all timelines', async () => {
            const mockTimelines = [
                {
                    id: 1,
                    entity_type: 'project',
                    entity_id: 123,
                    start_date: '2025-01-01',
                    end_date: '2025-12-31'
                },
                {
                    id: 2,
                    entity_type: 'doc',
                    entity_id: 456,
                    start_date: '2025-02-01',
                    end_date: '2025-03-31'
                }
            ];
            mockInvoke.mockResolvedValue(mockTimelines);
            const result = await service.listTimelines();
            expect(mockInvoke).toHaveBeenCalledWith('timeline_list', {});
            expect(result).toEqual(mockTimelines);
        });
    });
    describe('updateTimeline', () => {
        it('should update a timeline', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-15',
                end_date: '2025-12-31'
            };
            mockInvoke.mockResolvedValue(mockTimeline);
            const result = await service.updateTimeline(1, {
                start_date: '2025-01-15',
                end_date: '2025-12-31'
            });
            expect(mockInvoke).toHaveBeenCalledWith('timeline_update', {
                id: 1,
                payload: {
                    start_date: '2025-01-15',
                    end_date: '2025-12-31'
                }
            });
            expect(result).toEqual(mockTimeline);
        });
    });
    describe('deleteTimeline', () => {
        it('should delete a timeline', async () => {
            mockInvoke.mockResolvedValue(undefined);
            await service.deleteTimeline(1);
            expect(mockInvoke).toHaveBeenCalledWith('timeline_delete', { id: 1 });
        });
    });
    describe('deleteTimelineByEntity', () => {
        it('should delete a timeline by entity', async () => {
            mockInvoke.mockResolvedValue(undefined);
            await service.deleteTimelineByEntity('project', 123);
            expect(mockInvoke).toHaveBeenCalledWith('timeline_delete_by_entity', {
                entityType: 'project',
                entityId: 123
            });
        });
    });
    describe('upsertTimeline', () => {
        it('should upsert a timeline', async () => {
            const mockTimeline = {
                id: 1,
                entity_type: 'project',
                entity_id: 123,
                start_date: '2025-01-01',
                end_date: '2025-12-31'
            };
            mockInvoke.mockResolvedValue(mockTimeline);
            const result = await service.upsertTimeline('project', 123, '2025-01-01', '2025-12-31');
            expect(mockInvoke).toHaveBeenCalledWith('timeline_create', {
                payload: {
                    entity_type: 'project',
                    entity_id: 123,
                    start_date: '2025-01-01',
                    end_date: '2025-12-31'
                }
            });
            expect(result).toEqual(mockTimeline);
        });
    });
});
