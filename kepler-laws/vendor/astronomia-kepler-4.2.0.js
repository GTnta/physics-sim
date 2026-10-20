/*! astronomia 4.2.0: kepler3; Copyright 2013 Sonia Keys, 2016 commenthol. MIT. See LICENSE-astronomia.txt. */
var AstronomiaKepler=(()=>{var u=Object.defineProperty;var I=Object.getOwnPropertyDescriptor;var k=Object.getOwnPropertyNames;var y=Object.prototype.hasOwnProperty;var Y=(r,t)=>{for(var n in t)u(r,n,{get:t[n],enumerable:!0})},w=(r,t,n,e)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of k(t))!y.call(r,o)&&o!==n&&u(r,o,{get:()=>t[o],enumerable:!(e=I(t,o))||e.enumerable});return r};var A=r=>w(u({},"__esModule",{value:!0}),r);var nt={};Y(nt,{kepler3:()=>P});var D=.01720209895,B=149597870,T=.397777156,C=.917482062;function S(r){return .0057755183*r}var E=24000005e-1,c=2451545,F=2415020,l=24150203135e-4,O=24332824235e-4,h=365.25,M=36525,p=365.2421988,R=365.25636;function j(r){return c+h*(r-2e3)}function q(r){return 2e3+(r-c)/h}function v(r){return l+p*(r-1900)}function K(r){return 1900+(r-l)/p}function L(r){return(r-c)/M}function U(r){return(1+Math.cos(r))*.5}var f=class{constructor(t,n,e,o){this._ra=t||0,this._dec=n||0,this.range=e,this.elongation=o}get ra(){return this._ra}set ra(t){this._ra=t}get dec(){return this._dec}set dec(t){this._dec=t}get lon(){return this._ra}set lon(t){this._ra=t}get lat(){return this._dec}set lat(t){this._dec=t}};function z(r,t){let n=r.ra,e=r.dec,o=t.ra,i=t.dec,s=Math.sin(e),J=Math.cos(e),g=Math.sin(i),x=Math.cos(i),b=Math.sin(o-n),_=Math.cos(o-n),a=Math.atan2(x*b,g*J-x*s*_);return a<0&&(a+=2*Math.PI),a}var d=10*Math.PI/180/60,G=Math.cos(d);function H(r,t){let n=r%t;return n<0&&(n+=t),n}function N(r,...t){Array.isArray(t[0])&&(t=t[0]);let n=t.length-1,e=t[n];for(;n>0;)n--,e=e*r+t[n];return e}function Q(r,t){let n=r/t;return Math.floor(n)}function V(r,t){return r<t?-1:r>t?1:0}function W(r){return[Math.sin(r),Math.cos(r)]}function X(r){return Math.PI/180*r}function Z(r){return 180/Math.PI*r}function $(r){let t=Math.trunc(r),n=Math.abs(r-t);return[t,n]}function tt(r,t=14){return parseFloat(r.toFixed(t))}function rt(r,t){let n=new Error(r);return n.code=t,n}var m={K:D,AU:B,SOblJ2000:T,COblJ2000:C,lightTime:S,JMod:E,J2000:c,J1900:F,B1900:l,B1950:O,JulianYear:h,JulianCentury:M,BesselianYear:p,meanSiderealYear:R,JulianYearToJDE:j,JDEToJulianYear:q,BesselianYearToJDE:v,JDEToBesselianYear:K,J2000Century:L,illuminated:U,Coord:f,limb:z,SmallAngle:d,CosSmallAngle:G,pmod:H,horner:N,floorDiv:Q,cmp:V,sincos:W,toRad:X,toDeg:Z,modf:$,round:tt,errorCode:rt};function P(r,t){t=m.pmod(t,2*Math.PI);let n=1;t>Math.PI&&(n=-1,t=2*Math.PI-t);let e=Math.PI*.5,o=Math.PI*.25;for(let i=0;i<53;i++){let s=e-r*Math.sin(e);t-s<0?e-=o:e+=o,o*=.5}return n<0?-e:e}return A(nt);})();
/*! Bundled license information:

astronomia/src/base.js:
  (**
   * @copyright 2013 Sonia Keys
   * @copyright 2016 commenthol
   * @license MIT
   * @module base
   *)

astronomia/src/iterate.js:
  (**
   * @copyright 2013 Sonia Keys
   * @copyright 2016 commenthol
   * @license MIT
   * @module iterate
   *)

astronomia/src/kepler.js:
  (**
   * @copyright 2013 Sonia Keys
   * @copyright 2016 commenthol
   * @license MIT
   * @module kepler
   *)
*/
if(typeof module==='object'&&module.exports)module.exports=AstronomiaKepler;
