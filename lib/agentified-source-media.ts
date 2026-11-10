import { agentifiedL01Media } from './agentified-l01-media'
import { agentifiedL02L04Media } from './agentified-l02-l04-media'
import { agentifiedL05L08Media } from './agentified-l05-l08-media'
import { agentifiedL09L12Media } from './agentified-l09-l12-media'
import { agentifiedL13L16Media } from './agentified-l13-l16-media'

export const agentifiedSourceMedia = { L01: agentifiedL01Media, ...agentifiedL02L04Media, ...agentifiedL05L08Media, ...agentifiedL09L12Media, ...agentifiedL13L16Media }
