import { describe, expect, it } from 'vitest'
import { socialReleaseReview } from './social-release-review-ui'
describe('release review UI', () => {
  it.each(['claimed','submitting','publishing','uncertain','ambiguous','submitted'])('locks %s release evidence',status=>{
    expect(socialReleaseReview({rag_context:{platform_submission_gate:{status}}},'linkedin').locked).toBe(true)
  })
  it('locks failed receipts with provider evidence',()=>{
    expect(socialReleaseReview({publishes:[{platform:'linkedin',status:'failed',platform_post_id:'provider'}]},'linkedin')).toMatchObject({locked:true,continuation:false})
  })
  it('allows only pending unsubmitted platforms through a new final approval after partial confirmation',()=>{
    const item={rag_context:{platform_submission_gate:{status:'partially_submitted',confirmed_platforms:{linkedin:'provider'}}},publishes:[{platform:'linkedin',status:'published',platform_post_id:'provider'},{platform:'x',status:'pending'}]}
    expect(socialReleaseReview(item,'linkedin')).toMatchObject({locked:true,continuation:false,label:'Post confirmed'})
    expect(socialReleaseReview(item,'x')).toMatchObject({locked:false,continuation:true})
    expect(socialReleaseReview({...item,rag_context:{platform_submission_gate:{...item.rag_context.platform_submission_gate,status:'uncertain'}}},'x')).toMatchObject({locked:true,continuation:false})
  })
  it.each([{status:'failed'},{status:'published'},{status:'submitted'},{status:'queued'},{status:'unknown'},{status:'published',platform_post_url:'https://example.com/post'},{status:'pending',platform_post_id:'unexpected'}])('locks ambiguous receipt %j without inventing confirmation', receipt=>{
    const view=socialReleaseReview({publishes:[{platform:'linkedin',...receipt}]},'linkedin')
    expect(view).toMatchObject({locked:true,phase:'Reconcile',continuation:false})
    expect(view.label).not.toBe('Post confirmed')
  })

})
