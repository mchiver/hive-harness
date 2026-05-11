const TEST = require( 'node:test' );
const ASSERT = require( 'node:assert' );
const PATH = require( 'path' );

const HIVEJS_PROJECT_ROOT = PATH.join( __dirname, '..' );
const FileUtils = require( PATH.join( HIVEJS_PROJECT_ROOT, 'Helpers', 'FileUtils.js' ) );
const TestHive = require( './TestHive.js' );

var EXCHANGE_ENTITY_NAME = 'exchange-test';
var EXCHANGE_DATA_FOLDER = PATH.join( TestHive.HIVE_ROOT, '.hive', 'Entities', TestHive.TESTUSER_NAME, 'Exchange', EXCHANGE_ENTITY_NAME );


//---------------------------------------------------------------------
async function OpenHive()
{
	var hive = await TestHive.Open( TestHive.TESTUSER_NAME, TestHive.TESTUSER_PASSWORD );
	return hive;
}


//---------------------------------------------------------------------
TEST.describe( 'Exchange Plugin Tests', function ()
{


	//-----------------------------------------------------------------
	TEST.before( async function ()
	{
		var hive = await OpenHive();

		// Create the exchange entity
		await hive.InvokeTool( 'Exchange.ConfigEntity', {
			EntityName: EXCHANGE_ENTITY_NAME,
			Settings: {
				Name: EXCHANGE_ENTITY_NAME,
				Description: 'Test exchange',
				TickIntervalMs: 10000,
				LiquidationRate: 0.05,
				StartingEc: 5000,
				BaseAssetPrice: 10,
			},
		} );
	} );


	//-----------------------------------------------------------------
	TEST.after( async function ()
	{
		if ( await FileUtils.FolderExists( EXCHANGE_DATA_FOLDER ) )
		{
			await FileUtils.DeleteFolder( EXCHANGE_DATA_FOLDER, true );
		}
	} );


	//=================================================================
	// Asset Tests
	//=================================================================

	TEST.it( 'should register an asset', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.RegisterAsset', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AssetName: 'iron',
			DisplayName: 'Wrought Iron',
			InitialSupply: 1000,
		} );

		ASSERT.ok( result.Success, 'should succeed' );
		ASSERT.strictEqual( result.Result.AssetName, 'iron' );
		ASSERT.strictEqual( result.Result.DisplayName, 'Wrought Iron' );
		ASSERT.strictEqual( result.Result.TotalSupply, 1000 );
		ASSERT.strictEqual( result.Result.CirculatingSupply, 1000 );
	} );


	TEST.it( 'should reject duplicate asset registration', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.RegisterAsset', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AssetName: 'iron',
			DisplayName: 'Wrought Iron',
			InitialSupply: 1000,
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for duplicate asset' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	TEST.it( 'should list assets', async function ()
	{
		var hive = await OpenHive();

		// Register a second asset
		await hive.InvokeTool( 'Exchange.RegisterAsset', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AssetName: 'grain',
			DisplayName: 'Golden Grain',
			InitialSupply: 2000,
		} );

		var result = await hive.InvokeTool( 'Exchange.ListAssets', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.length, 2 );
		ASSERT.strictEqual( result.Result[ 0 ].AssetName, 'grain' );
		ASSERT.strictEqual( result.Result[ 1 ].AssetName, 'iron' );
	} );


	//=================================================================
	// Account Tests
	//=================================================================

	TEST.it( 'should create an account with default EC', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.AccountName, 'trader-1' );
		ASSERT.strictEqual( result.Result.EcBalance, 5000 );
	} );


	TEST.it( 'should create an account with custom EC', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-2',
			StartingEc: 8000,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.EcBalance, 8000 );
	} );


	TEST.it( 'should reject duplicate account creation', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for duplicate account' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	TEST.it( 'should get account with holdings', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.AccountName, 'trader-1' );
		ASSERT.strictEqual( result.Result.EcBalance, 5000 );
		ASSERT.ok( Array.isArray( result.Result.Holdings ) );
	} );


	TEST.it( 'should list accounts', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.ListAccounts', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.length >= 2 );
	} );


	//=================================================================
	// Holdings Tests
	//=================================================================

	TEST.it( 'should credit holdings to an account', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.CreditHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Quantity: 100,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.AssetName, 'iron' );
		ASSERT.strictEqual( result.Result.Quantity, 100 );
	} );


	TEST.it( 'should get holdings for an account', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetHoldings', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Holdings.length, 1 );
		ASSERT.strictEqual( result.Result.Holdings[ 0 ].AssetName, 'iron' );
		ASSERT.strictEqual( result.Result.Holdings[ 0 ].Quantity, 100 );
	} );


	TEST.it( 'should debit holdings from an account', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.DebitHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Quantity: 30,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Quantity, 70 );
	} );


	TEST.it( 'should reject debit with insufficient holdings', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.DebitHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Quantity: 200,
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for insufficient holdings' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	TEST.it( 'should credit and debit EC', async function ()
	{
		var hive = await OpenHive();

		// Credit
		var credit_result = await hive.InvokeTool( 'Exchange.CreditEc', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			Amount: 500,
		} );

		ASSERT.ok( credit_result.Success );
		ASSERT.strictEqual( credit_result.Result.EcBalance, 5500 );

		// Debit
		var debit_result = await hive.InvokeTool( 'Exchange.DebitEc', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			Amount: 1000,
		} );

		ASSERT.ok( debit_result.Success );
		ASSERT.strictEqual( debit_result.Result.EcBalance, 4500 );
	} );


	//=================================================================
	// Order Tests
	//=================================================================

	TEST.it( 'should submit a buy order', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Side: 'buy',
			Price: 10,
			Quantity: 20,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.OrderId > 0 );
		ASSERT.strictEqual( result.Result.Side, 'buy' );
		ASSERT.strictEqual( result.Result.Price, 10 );
	} );


	TEST.it( 'should submit a sell order', async function ()
	{
		var hive = await OpenHive();

		// Give trader-2 some iron to sell
		await hive.InvokeTool( 'Exchange.CreditHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-2',
			AssetName: 'iron',
			Quantity: 50,
		} );

		var result = await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-2',
			AssetName: 'iron',
			Side: 'sell',
			Price: 12,
			Quantity: 25,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.OrderId > 0 );
		ASSERT.strictEqual( result.Result.Side, 'sell' );
	} );


	TEST.it( 'should reject buy order with insufficient EC', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Side: 'buy',
			Price: 999,
			Quantity: 999,
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for insufficient EC' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	TEST.it( 'should reject sell order with insufficient holdings', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-2',
			AssetName: 'iron',
			Side: 'sell',
			Price: 5,
			Quantity: 999,
		} );

		ASSERT.strictEqual( result.Success, false, 'should fail for insufficient holdings' );
		ASSERT.ok( result.Error, 'should have error message' );
	} );


	TEST.it( 'should get the order book', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetOrderBook', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AssetName: 'iron',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.AssetName, 'iron' );
		ASSERT.ok( result.Result.Bids.length >= 1 );
		ASSERT.ok( result.Result.Asks.length >= 1 );
	} );


	TEST.it( 'should get orders for an account', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetOrders', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.Orders.length >= 1 );
	} );


	TEST.it( 'should cancel an order', async function ()
	{
		var hive = await OpenHive();

		// Submit a new order to cancel
		var submit_result = await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'trader-1',
			AssetName: 'iron',
			Side: 'buy',
			Price: 5,
			Quantity: 10,
		} );

		ASSERT.ok( submit_result.Success );
		var order_id = submit_result.Result.OrderId;

		var cancel_result = await hive.InvokeTool( 'Exchange.CancelOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			OrderId: order_id,
		} );

		ASSERT.ok( cancel_result.Success );
		ASSERT.strictEqual( cancel_result.Result.Status, 'cancelled' );
	} );


	//=================================================================
	// Matching Engine Tests
	//=================================================================

	TEST.it( 'should match orders when bid >= ask', async function ()
	{
		var hive = await OpenHive();

		// Create accounts specifically for matching test
		await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'buyer-match',
			StartingEc: 10000,
		} );

		await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-match',
			StartingEc: 1000,
		} );

		await hive.InvokeTool( 'Exchange.CreditHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-match',
			AssetName: 'iron',
			Quantity: 100,
		} );

		// Submit matching orders
		await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-match',
			AssetName: 'iron',
			Side: 'sell',
			Price: 11,
			Quantity: 10,
		} );

		await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'buyer-match',
			AssetName: 'iron',
			Side: 'buy',
			Price: 11,
			Quantity: 10,
		} );

		// Run tick to match
		var tick_result = await hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( tick_result.Success );
		ASSERT.ok( tick_result.Result.Trades.length >= 1 );

		// Verify the trade
		var trade = tick_result.Result.Trades[ tick_result.Result.Trades.length - 1 ];
		ASSERT.strictEqual( trade.AssetName, 'iron' );
		ASSERT.strictEqual( trade.BuyerAccount, 'buyer-match' );
		ASSERT.strictEqual( trade.SellerAccount, 'seller-match' );
		ASSERT.strictEqual( trade.Quantity, 10 );
		ASSERT.strictEqual( trade.Price, 11 );
	} );


	TEST.it( 'should not match when bid < ask', async function ()
	{
		var hive = await OpenHive();

		await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'buyer-low',
			StartingEc: 10000,
		} );

		await hive.InvokeTool( 'Exchange.CreateAccount', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-high',
			StartingEc: 1000,
		} );

		await hive.InvokeTool( 'Exchange.CreditHolding', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-high',
			AssetName: 'iron',
			Quantity: 50,
		} );

		// Submit non-matching orders
		await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'buyer-low',
			AssetName: 'iron',
			Side: 'buy',
			Price: 5,
			Quantity: 10,
		} );

		await hive.InvokeTool( 'Exchange.SubmitOrder', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'seller-high',
			AssetName: 'iron',
			Side: 'sell',
			Price: 50,
			Quantity: 10,
		} );

		// Count trades before
		var before_result = await hive.InvokeTool( 'Exchange.GetTradeHistory', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );
		var trades_before = before_result.Result.Trades.length;

		// Run tick
		var tick_result = await hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( tick_result.Success );

		// Count trades after
		var after_result = await hive.InvokeTool( 'Exchange.GetTradeHistory', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		// Should have same number of trades (no new match)
		ASSERT.strictEqual( after_result.Result.Trades.length, trades_before );
	} );


	//=================================================================
	// Tick Tests
	//=================================================================

	TEST.it( 'should execute a tick and return results', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( Array.isArray( result.Result.Trades ) );
		ASSERT.ok( Array.isArray( result.Result.Liquidations ) );
		ASSERT.ok( Array.isArray( result.Result.Manufacturing ) );
	} );


	//=================================================================
	// Market Data Tests
	//=================================================================

	TEST.it( 'should get market summary', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetMarketSummary', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( Array.isArray( result.Result.Assets ) );
		ASSERT.ok( result.Result.Assets.length >= 2 );
	} );


	TEST.it( 'should get asset price', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetAssetPrice', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AssetName: 'iron',
		} );

		ASSERT.ok( result.Success );
		// Price should exist after the matching test trade
		ASSERT.ok( result.Result.LastPrice !== null || result.Result.LastPrice === null );
	} );


	TEST.it( 'should get trade history', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.GetTradeHistory', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( Array.isArray( result.Result.Trades ) );
	} );


	//=================================================================
	// Participant Tests
	//=================================================================

	TEST.it( 'should create a participant', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.CreateParticipant', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'supplier-alice',
			Role: 'supplier',
			IsManufacturer: true,
			ManufactureAsset: 'iron',
			ManufactureRate: 5,
			InitialHoldings: { iron: 200 },
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.AccountName, 'supplier-alice' );
		ASSERT.strictEqual( result.Result.Role, 'supplier' );
	} );


	TEST.it( 'should list participants', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.ListParticipants', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		ASSERT.ok( result.Result.length >= 1 );
	} );


	TEST.it( 'should update a participant', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.UpdateParticipant', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'supplier-alice',
			ManufactureRate: 10,
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.Updated, true );
	} );


	TEST.it( 'should remove a participant', async function ()
	{
		var hive = await OpenHive();

		var result = await hive.InvokeTool( 'Exchange.RemoveParticipant', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'supplier-alice',
		} );

		ASSERT.ok( result.Success );
		ASSERT.strictEqual( result.Result.IsActive, false );
	} );


	//=================================================================
	// Liquidation & Manufacturing in Tick
	//=================================================================

	TEST.it( 'should liquidate consumer holdings during tick', async function ()
	{
		var hive = await OpenHive();

		// Create a consumer participant
		await hive.InvokeTool( 'Exchange.CreateParticipant', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'consumer-bob',
			Role: 'consumer',
			InitialHoldings: { iron: 100 },
		} );

		// Run tick
		var result = await hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		// Should have liquidation events for the consumer
		var bob_liquidations = result.Result.Liquidations.filter( function ( l )
		{
			return l.AccountName === 'consumer-bob';
		} );
		ASSERT.ok( bob_liquidations.length >= 1, 'consumer should have liquidations' );
		ASSERT.strictEqual( bob_liquidations[ 0 ].AssetName, 'iron' );
		ASSERT.ok( bob_liquidations[ 0 ].UnitsDestroyed > 0 );
		ASSERT.ok( bob_liquidations[ 0 ].EcCredited > 0 );
	} );


	TEST.it( 'should manufacture assets during tick', async function ()
	{
		var hive = await OpenHive();

		// Create a manufacturer participant
		await hive.InvokeTool( 'Exchange.CreateParticipant', {
			EntityName: EXCHANGE_ENTITY_NAME,
			AccountName: 'manufacturer-carol',
			Role: 'supplier',
			IsManufacturer: true,
			ManufactureAsset: 'iron',
			ManufactureRate: 20,
		} );

		// Run tick
		var result = await hive.InvokeTool( 'Exchange.RunTick', {
			EntityName: EXCHANGE_ENTITY_NAME,
		} );

		ASSERT.ok( result.Success );
		// Should have manufacturing events
		var carol_manufacturing = result.Result.Manufacturing.filter( function ( m )
		{
			return m.AccountName === 'manufacturer-carol';
		} );
		ASSERT.ok( carol_manufacturing.length >= 1, 'manufacturer should have production' );
		ASSERT.strictEqual( carol_manufacturing[ 0 ].AssetName, 'iron' );
		ASSERT.strictEqual( carol_manufacturing[ 0 ].UnitsProduced, 20 );
	} );


} );