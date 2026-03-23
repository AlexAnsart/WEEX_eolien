rawEol= readtable('Eolien_Type14');
X=rawEol(:,1);
Y=rawEol(:,3);
X2=rows2vars(X);
X2(:,1)=[];
V=table2array(X2);

Y2=rows2vars(Y);
Y2(:,1)=[];
Pelec=table2array(Y2);
plot(V,Pelec,'b+');


D=80;
rho=1.25;
N=length(V);
rend=zeros(1,N);

for i=1:N
    rend(i)=27/16*2*4/rho/(V(i)^3)/pi/(D^2)*Pelec(i);
end

eta=mean(rend)
eta*16/27;




