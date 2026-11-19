import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const fixture = JSON.parse(readFileSync(new URL('./synthetic-fixtures.json', import.meta.url), 'utf8'))

assert.equal(fixture.synthetic, true)
assert.match(fixture.page.id, /SYNTHETIC/)
assert.equal(fixture.page.followers_count, 42)
assert.equal(fixture.feed.data.length, 1)
assert.equal(new Set(fixture.feed.data.map((post) => post.id)).size, fixture.feed.data.length)
assert.equal(fixture.comments.parentPostId, fixture.feed.data[0].id)
assert.equal(fixture.reactions.parentPostId, fixture.feed.data[0].id)
assert.equal(fixture.comments.summary.total_count, 1)
assert.equal(fixture.reactions.summary.total_count, 3)
assert.deepEqual(fixture.emptyAuthorizedFeed.data, [])

const receiptFields = [
  'app_id', 'page_id', 'api_version', 'endpoint_class', 'source_id',
  'retrieved_at', 'permission_gate', 'response_status',
]
assert.deepEqual(Object.keys(fixture.expectedReceipt).sort(), receiptFields.sort())
assert.equal(fixture.expectedReceipt.source_id, fixture.feed.data[0].id)
assert.equal(fixture.expectedReceipt.page_id, fixture.page.id)

const blocked = new Set(fixture.blockedCases.map((item) => item.case))
assert.deepEqual(blocked, new Set([
  'ratings_current_version', 'comment_body', 'non_role_operator', 'missing_page_task',
]))

const serialized = JSON.stringify(fixture).toLowerCase()
for (const forbidden of [
  'access_token', 'app_secret', 'cookie', 'email', 'phone',
  'profile_url', 'friend_list', 'group_member', 'paging.next',
]) {
  assert.equal(serialized.includes(forbidden), false, `forbidden fixture content: ${forbidden}`)
}

console.log('Synthetic managed-Page contract: passed')
