export interface GameManifest {
  id: string
  name: string
  description: string
  version: string
  entry: string
}

export interface GameModule {
  init(container: HTMLElement, savedState: unknown): void
  getState(): unknown
  getScore(): number
  destroy?(): void
}
