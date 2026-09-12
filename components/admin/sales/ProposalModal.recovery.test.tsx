import {fireEvent,render,screen} from '@testing-library/react'
import {expect,it,vi} from 'vitest'
vi.mock('@/lib/auth',()=>({getCurrentSession:vi.fn().mockResolvedValue(null)}))
import {ProposalModal} from './ProposalModal'
const saved={id:'saved',status:'draft',client_name:'Synthetic',client_company:null,bundle_name:'Saved offer',total_amount:997,line_items:[{title:'Saved item',price:997}],terms_text:'Exact reviewed terms',valid_until:null,access_code:null,pdf_url:null}
const props={onClose:vi.fn(),onGenerate:vi.fn(),defaultClientName:'Synthetic',defaultClientEmail:'example@example.invalid',defaultClientCompany:'',totalAmount:997,contactId:null,defaultValueReportId:null}
it('reopens exact saved terms with existing document actions and no duplicate generation',()=>{
 render(<ProposalModal {...props} savedProposal={saved} generationDisabled reviewSection={<button>Attach document</button>}/>);
 expect(screen.getByText('Exact reviewed terms')).toBeTruthy();expect(screen.getByText('Saved item')).toBeTruthy();expect(screen.getByText('Expiry: No expiry')).toBeTruthy();expect(screen.getByRole('button',{name:'Attach document'})).toBeTruthy()
 expect(screen.queryByRole('button',{name:'Generate Proposal'})).toBeNull();expect(screen.queryByRole('link',{name:'Open issued client proposal'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Create another proposal'}));expect((screen.getByRole('button',{name:'Generate Proposal'}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Return to saved proposal'}));expect(screen.getByText('Exact reviewed terms')).toBeTruthy()
})
it('keeps issued client links and does not label a paid legacy record unissued',()=>{
 const view=render(<ProposalModal {...props} savedProposal={{...saved,status:'paid',access_code:'ABC123'}}/>);
 expect(screen.getByRole('link',{name:'Open issued client proposal'}).getAttribute('href')).toBe('https://amadutown.com/proposal/ABC123')
 view.rerender(<ProposalModal {...props} savedProposal={{...saved,status:'paid'}}/>);
 expect(screen.queryByText('Unissued draft. Client sharing is unavailable.')).toBeNull()
})
