import type {
  extensions as Extensions,
  process as ProcessApi,
  ProviderContainerConnection,
  type Disposable,
  ImageInspectInfo,
  containerEngine as containersApi,
  ContainerInspectInfo,
} from '@podman-desktop/api';
import type { PodmanExtensionApi } from '@podman-desktop/podman-extension-api';
import { PODMAN_EXTENSION_ID } from '../utils/constants';
import type { ProviderService } from './provider-service';
import type { PodmanConnection } from '../schemas/podman-connection';

export interface PodmanDependencies {
  extensions: typeof Extensions;
  providers: ProviderService;
  processApi: typeof ProcessApi;
  containers: typeof containersApi;
}

export class PodmanService implements Disposable {
  constructor(protected dependencies: PodmanDependencies) {}

  // smart podman extension api getter with some cache
  #podman: PodmanExtensionApi | undefined;
  protected get podman(): PodmanExtensionApi {
    if (!this.#podman) {
      this.#podman = this.getPodmanExtension();
    }
    return this.#podman;
  }

  dispose(): void {
    this.#podman = undefined;
  }

  /**
   * Check if a given machine is rootful
   * @param connection
   */
  public async isMachineRootful(connection: ProviderContainerConnection): Promise<boolean> {
    if (!connection.connection.vmType)
      throw new Error('connection provided is not a podman machine (native connection)');

    const result = await this.podman.exec(
      ['machine', 'inspect', '--format', '{{.Rootful}}', connection.connection.name],
      {
        connection: connection,
      },
    );
    return result.stdout.trim() === 'true';
  }

  protected getPodmanExtension(): PodmanExtensionApi {
    const podman = this.dependencies.extensions.getExtension(PODMAN_EXTENSION_ID);
    if (!podman) throw new Error('podman extension not found');

    if (!('exec' in podman.exports) || typeof podman.exports.exec !== 'function') {
      throw new Error('invalid podman extension exports');
    }

    return podman.exports;
  }

  /**
   * This method return the ContainerProviderConnection corresponding to an engineId
   * @remarks only works with running container connection
   * @param engineId
   */
  async getRunningProviderContainerConnectionByEngineId(engineId: string): Promise<ProviderContainerConnection> {
    for (const provider of this.dependencies.providers.getContainerConnections()) {
      if (provider.connection.status() !== 'started') continue;

      const infos = await this.dependencies.containers.listInfos({ provider: provider.connection });
      if (infos.length === 0) continue;

      if (infos[0].engineId === engineId) return provider;
    }
    throw new Error('connection not found');
  }

  /**
   * Get podman connections
   * @remarks only ssh protocol is supported
   */
  public async getPodmanConnections(): Promise<Array<PodmanConnection>> {
    const { stdout } = await this.podman.exec(['system', 'connection', 'ls', '--format=json']);
    const connections: Array<PodmanConnection> = JSON.parse(stdout);
    // validate output
    if (!Array.isArray(connections)) throw new Error('malformed output for podman system connection ls command.');

    // filter out all machines (that are local)
    return connections.filter(connection => connection.URI.startsWith('ssh:'));
  }

  public async clone(container: ContainerInspectInfo, alternative: string): Promise<{
    engineId: string;
    Id: string;
  }> {
    const connection = await this.getRunningProviderContainerConnectionByEngineId(container.engineId);

    const result = await this.podman.exec(['container','clone', container.Id, `${container.Name}-clone`, alternative], {
      connection: connection,
    });

    return {
      engineId: container.engineId,
      Id: result.stdout.trim(),
    };
  }
}
