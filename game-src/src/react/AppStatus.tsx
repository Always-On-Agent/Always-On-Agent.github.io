import { createPortal } from 'react-dom'
import { withInjectableUi } from './extendableSystem'

const AppStatusBase = ({ status, isError }: any) => {
  const zh = new URLSearchParams(location.search).get('lang') === 'zh'
  return createPortal(<div style={{position:'fixed',inset:0,zIndex:10000,display:'grid',placeContent:'center',textAlign:'center',padding:24,color:'#315348',background:'linear-gradient(145deg,#f0f5ed,#dae8e1 55%,#b3cece)',font:'15px/1.6 system-ui,sans-serif'}}>
    <img src='./favicon.png' alt='' style={{width:52,height:52,borderRadius:13,margin:'0 auto 18px'}} />
    <div style={{fontSize:19,fontWeight:600}}>{isError ? (zh ? '场景暂时未能加载' : 'The scene could not load') : (zh ? '正在准备你的场景…' : 'Preparing your scene…')}</div>
    <div style={{fontSize:13,opacity:.7,marginTop:8}}>{isError ? (zh ? '请刷新重试。' : 'Please refresh to try again.') : (zh ? '正在加载地形与眼镜视角' : 'Loading the world and your glasses')}</div>
    {isError && <><button style={{margin:'20px auto',padding:'10px 20px',border:'1px solid #a9c8b8',borderRadius:12,background:'#fff',color:'#315348',cursor:'pointer'}} onClick={() => location.reload()}>{zh ? '重新加载' : 'Try again'}</button><details style={{fontSize:12,maxWidth:540,overflowWrap:'anywhere'}}><summary>{zh ? '错误详情' : 'Error details'}</summary>{String(status)}</details></>}
  </div>, document.body)
}
export default withInjectableUi(AppStatusBase, 'appStatus')
