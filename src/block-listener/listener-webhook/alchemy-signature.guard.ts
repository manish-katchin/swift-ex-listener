import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

// Alchemy sends network as e.g. ETH_MAINNET, split('_')[0] gives the prefix
const NETWORK_SIGNING_KEY_MAP: Record<string, string> = {
  ETH:  'ALCHEMY_WEBHOOKID_ETH_SIGN',
  BNB:  'ALCHEMY_WEBHOOKID_BNB_SIGN',
  OPT:  'ALCHEMY_WEBHOOKID_OP_SIGN',
  BASE: 'ALCHEMY_WEBHOOKID_BASE_SIGN',
  AVAX: 'ALCHEMY_WEBHOOKID_AVAX_SIGN',
  MATIC:'ALCHEMY_WEBHOOKID_POL_SIGN',  // Polygon = MATIC_MAINNET
  ARB:  'ALCHEMY_WEBHOOKID_ARB_SIGN',
};

@Injectable()
export class AlchemySignatureGuard implements CanActivate {
  private readonly logger = new Logger(AlchemySignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-alchemy-signature'];

    if (!signature) {
      this.logger.warn('Missing x-alchemy-signature header');
      throw new UnauthorizedException('Missing signature');
    }

    const network = req.body?.event?.network?.split('_')[0];
    const envKey = NETWORK_SIGNING_KEY_MAP[network];
    const signingKey = envKey ? process.env[envKey] : undefined;

    if (!signingKey) {
      this.logger.warn(`No signing key found for network: ${network}`);
      throw new UnauthorizedException('Unknown network');
    }

    const rawBody = req.rawBody;
    const hmac = crypto
      .createHmac('sha256', signingKey)
      .update(rawBody)
      .digest('hex');

    if (hmac !== signature) {
      this.logger.warn(`Invalid signature for network: ${network}`);
      throw new UnauthorizedException('Invalid signature');
    }

    return true;
  }
}
