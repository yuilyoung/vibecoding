export class StudioPhotoProjectAdapter {
  constructor(studioService) { this.studioService = studioService; }
  async createVariant(draft) { return this.studioService.createPhotorealisticProject(draft); }
  async getVariant(projectId) { return this.studioService.getPhotorealisticProject(projectId); }
}
