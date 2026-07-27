export class SynchronousActionLock {
  private locked = false;

  tryLock(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  release(): void {
    this.locked = false;
  }
}
